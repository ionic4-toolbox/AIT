/**
    AiT - Another Interval Timer
    Copyright (C) 2019 Marc Kassay

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { AfterViewInit, ChangeDetectorRef, ComponentFactoryResolver, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';

import { FabAction, FabContainerComponent, FabEmission } from '../components/fab-container/fab-container';
import { SideMenuResponse, SideMenuService } from '../components/side-menu/side-menu.service';
import { ScreenService } from '../services/screen.service';
import { SignalService } from '../services/signal.service';
import { SotsForAit } from '../services/sots/ait-sots';
import { SequenceStates } from '../services/sots/ait-sots.util';
import { UUIDData } from '../services/storage/ait-storage.shapes';

export class DisplayPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(FabContainerComponent)
  protected floatingbuttons: FabContainerComponent;

  subject: BehaviorSubject<UUIDData>;

  protected _uuidData: any;
  get uuidData(): any {
    return this._uuidData;
  }
  set uuidData(value: any) {
    this._uuidData = value;
  }

  protected _settingsPageClass: any;
  protected get settingsPageClass(): any {
    return this._settingsPageClass;
  }
  protected set settingsPageClass(value: any) {
    this._settingsPageClass = value;
  }

  // this type assignment to variable is for Angular template can access enum values.
  SS = SequenceStates;
  private _timerState: SequenceStates;
  protected get timerState(): SequenceStates {
    return this._timerState;
  }
  protected set timerState(value: SequenceStates) {
    this._timerState = value;
  }

  protected sots: SotsForAit;
  protected grandTime: string;

  /**
   * When entering into display-pages, initially or not, this flag is used to determine if the timer
   * needs to be rebuilt. For instance, if the user changes a setting that is irrelvent to `sots`,
   * then rebuilding of `sots` is required.
   */
  protected noRebuild: boolean;

  constructor(
    @Optional() protected route: ActivatedRoute,
    @Optional() protected componentFactoryResolver: ComponentFactoryResolver,
    @Optional() protected changeRef: ChangeDetectorRef,
    @Optional() protected menuCtrl: MenuController,
    @Optional() protected signalSvc: SignalService,
    @Optional() protected screenSvc: ScreenService,
    @Optional() protected menuSvc: SideMenuService
  ) { }

  ngOnInit(): void {
    this.sots = new SotsForAit();

    this.signalSvc.onInit();
    this.screenSvc.onInit();

    this.route.data.subscribe((data: { subject: BehaviorSubject<UUIDData> }) => {
      this.subject = data.subject;
    });

    this.subject.subscribe((uuidData: UUIDData) => {
      // TODO: pipe a 'distinctUntil' operator for coming back from settings
      if (this.uuidData) {
        this.uuidData = uuidData;
        this.aitBuildTimer();
        this.aitSubscribeTimer();
        this.aitPostBuildTimer();
      } else {
        this.uuidData = uuidData;
      }
    });
  }

  ngAfterViewInit(): void {
    this.attachSettingsAndCheckHome();
  }

  ngOnDestroy(): void {
    this.unsubscribe(true);
  }

  /**
   * Fired when the component being routed to is about to animate in.
   */
  ionViewWillEnter(): void {
    throw new Error('Subclasses of DisplayPage need to implement ionViewWillEnter().');
  }

  /**
   * Fired when the component being routed to has animated in. This is called only during startup
   * and when the user exits from the 'start' menu and returns. The 'end' menu is of no consequence.
   */
  ionViewDidEnter(): void {
    this.aitPostBuildTimer();
  }

  aitPostBuildTimer(): void {
    if (this.noRebuild === false) {
      this.timerState = SequenceStates.Loaded;
      this.floatingbuttons.setToLoadedMode();
    }

    // exclude menus since `ngAfterViewInit()` called method to do so.
    this.setAppToRunningMode(false, false);
  }

  /**
   * Fired when the component being routed from is about to animate.
   */
  // ionViewWillLeave(): void { }

  protected aitBuildTimer(): void {
    throw new Error('Subclasses of DisplayPage need to implement aitBuildTimer().');
  }

  protected aitSubscribeTimer(): void {
    throw new Error('Subclasses of DisplayPage need to implement aitSubscribeTimer().');
  }

  protected unsubscribe(includeSubject: boolean = false): void {
    this.sots.unsubscribe();
    if (includeSubject) {
      this.subject.unsubscribe();
    }
  }

  /**
   * Sets the page in 1 of two states, depending if the timer is ticking or not.
   *
   * @param value true if timer is ticking
   */
  protected async setAppToRunningMode(value: boolean, includeMenus = true): Promise<void> {
    await this.signalSvc.enablePreferredVolume(value)
      .catch((reason) => {
        if (reason === 'DO_NOT_DISTURB') {
          // at this point toast notification (from signalSvc) should appear to inform user
          this.sots.sequencer.pause();
          this.floatingbuttons.setToPausedMode();
          this.setAppToRunningMode(false);
        }
      });

    await this.screenSvc.setScreenToRunningMode(value);

    if (includeMenus) {
      await this.menuCtrl.enable(value === false, 'start');
      await this.menuCtrl.enable(value === false, 'end');
    }
  }

  private resetTimer(): void {
    this.timerState = SequenceStates.Loaded;
    this.grandTime = this.sots.getGrandTime({ time: -1 });
    this.sots.sequencer.reset();
  }

  /**
   * Calls `menuService` with setting page class and awaits until subscription notifies to check
   * home page too, so that side menus and floatingbuttons can be enabled accordingly.
   *
   * This method subscribes to only 2 responses and unconditional sends 1 request.
   *
   * First it sends request for settings page to be loaded into `end` sidemenu. Afterwards a response
   * stating "end is loaded", which it will request to App that `start` sidemenu can be loaded now.
   * And if or when `start` menu is loaded, the last response received will verify this and this
   * method is now done subcribing.
   */
  private attachSettingsAndCheckHome(): Promise<void> {
    return new Promise<void>((resolve, reject): void => {
      // subscribe to menu service
      const menuSubscription = this.menuSvc.subscribe((note) => {
        if ((note as SideMenuResponse).response !== undefined) {
          note = (note as SideMenuResponse);

          // when response from the 'this.menuSvc.next()' call below
          if ((note.subject === 'end') && (note.response === 'unloaded')) {
            const resolvedComponent = this.componentFactoryResolver.resolveComponentFactory(this.settingsPageClass);

            this.menuSvc.next({
              subject: 'end',
              request: 'load',
              uuid: (this.uuidData as UUIDData).uuid,
              component: resolvedComponent
            });
          } else if ((note.subject === 'end') && (note.response === 'loaded')) {
            this.floatingbuttons.setProgramButtonToVisible();
            this.menuCtrl.enable(true, 'end');

            this.menuSvc.next({
              subject: 'start',
              request: 'status',
              uuid: (this.uuidData as UUIDData).uuid
            });
            // when response from HomePage is loaded from App.component
          } else if ((note.subject === 'start') && (note.response === 'loaded')) {
            this.floatingbuttons.setHomeButtonToVisible();
            this.menuCtrl.enable(true, 'start');
            menuSubscription.unsubscribe();
            resolve();
          }
        }
      }, () => {
        reject();
      }, () => {
        reject();
      });

      // send request to see if this display-page subclass has its settings page loaded in the
      // 'end' sidemenu.
      this.menuSvc.next({
        subject: 'end',
        request: 'status',
        uuid: (this.uuidData as UUIDData).uuid
      });

    });
  }

  /**
   * When `this.fabcontainer` buttons are clicked, it will first execute code in
   * `fabcontainer.component` (Child component). afterwards it will execute this function.
   */
  action(emission: FabEmission): void {
    switch (emission.action) {
      case FabAction.Home:
        this.sots.sequencer.pause();
        this.setAppToRunningMode(false);
        this.floatingbuttons.setToPausedMode();
        this.menuCtrl.open('start');
        break;
      case FabAction.Program:
        this.sots.sequencer.pause();
        this.setAppToRunningMode(false);
        this.floatingbuttons.setToPausedMode();
        this.menuCtrl.open('end');
        break;
      case FabAction.Reset:
        this.resetTimer();
        this.setAppToRunningMode(false);
        break;
      case FabAction.Start:
        this.sots.sequencer.start();
        this.setAppToRunningMode(true);
        break;
      case FabAction.Pause:
        this.sots.sequencer.pause();
        this.setAppToRunningMode(false);
        break;
    }
  }
}

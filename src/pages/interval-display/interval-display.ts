import { Component, ViewChild, Input, ChangeDetectorRef } from '@angular/core';
import { IonicPage, NavController, NavParams, MenuController } from 'ionic-angular';
import { AnotherIntervalTimer, IIntervalEmission, IntervalState } from '../../app/core/AnotherIntervalTimer';
import { FabAction, FabEmission, FabContainerComponent } from '../../app/components/fabcontainer.component/fabcontainer.component'
import { Subscription } from 'rxjs';
import { AITStorage } from '../../app/core/AITStorage';
import { IntervalStorageData } from '../../app/app.component';
import { AITSignal } from '../../app/core/AITSignal';
import { Insomnia } from '@ionic-native/insomnia';
import { SplashScreen } from '@ionic-native/splash-screen';

@IonicPage()
@Component({
  selector: 'page-interval-display',
  templateUrl: 'interval-display.html'
})
export class IntervalDisplayPage {
  @ViewChild(FabContainerComponent)
  private menu: FabContainerComponent;

  current_uuid: string;

  timer: AnotherIntervalTimer;
  emitted: IIntervalEmission;
  subscription: Subscription;

  remainingTime: string;
  remainingIntervalTime: number;
  currentInterval: number;

  _data: IntervalStorageData;

  // used in ionViewDidLoad to load data for the initial loading.  after
  // ionViewDidLoad is called, ionViewDidEnter is then called; hence, we
  // dont want to run the same data twice.
  immediatelyPostViewDidLoad: boolean;

  get data(): IntervalStorageData {
    return this._data;
  }

  @Input('data')
  set data(value: IntervalStorageData) {
    this._data = value;
  }

  public states = IntervalState;
  _state: IntervalState;
  // if _state contains irrevlant bits to the view, "reduce" by removing those bits
  get viewState(): IntervalState {
    let _state_temp = this._state;
    // strip away Start and/or Instant states if needed...
    if (_state_temp & IntervalState.Start) {
      _state_temp -= IntervalState.Start;
    }
    if (_state_temp & IntervalState.Instant) {
      _state_temp -= IntervalState.Instant;
    }
    if (_state_temp & IntervalState.Warning) {
      _state_temp -= IntervalState.Warning;
    }

    return _state_temp;
  }

  constructor(public navCtrl: NavController,
    public navParams: NavParams,
    public menuCtrl: MenuController,
    public storage: AITStorage,
    public signal: AITSignal,
    public ngDectector: ChangeDetectorRef,
    public splashScreen: SplashScreen,
    public insomnia: Insomnia) {

    // if coming from right sidemenu (or any sidemenu), no 'ionXxx()' will be
    // called since sidemenus are just menus, not pages.
    menuCtrl.get('right').ionClose.debounceTime(250).subscribe(() => {
      this.ionViewDidEnterInterior();
    });
  }

  ionViewDidLoad() {
    this.ionViewDidEnterInterior();
    this.immediatelyPostViewDidLoad = true;
  }

  ionViewDidEnter() {
    if (!this.immediatelyPostViewDidLoad) {
      this.ionViewDidEnterInterior();
    } else {
      this.immediatelyPostViewDidLoad = false;
    }
  }

  ionViewDidEnterInterior() {
    this.setNotRunningFeatures();
    this.getIntervalStorageData();
  }

  getIntervalStorageData(): void {
    const uuid = (this.navParams.data) ? this.navParams.data : this.current_uuid;

    if (uuid) {
      this.menu.reset();
      if ((<Subscription>this.subscription) && !this.subscription.closed) {
        this.subscription.unsubscribe();
      }
      this.storage.getItem(uuid).then((value: any) => {
        this.data = (value as IntervalStorageData);
        this.instantiateTimer();

        // TOOD: can't seem to hide startup flash of white other then
        // to do the following:
        setTimeout(() => {
          this.splashScreen.hide();
        }, 500);

      }).catch((reject) => {
        //console.log("interval-display preinitializeDisplay error")
      });
    }
  }

  instantiateTimer() {
    this._state = IntervalState.Loaded;
    this.remainingIntervalTime = this.data.activerest.lower;
    this.timer = new AnotherIntervalTimer(this.data.activerest.upper,
      this.data.activerest.lower,
      this.data.intervals,
      this.data.getready,
      this.data.countdown,
      this.data.warnings);
    this.subscribeTimer();
    this.remainingTime = this.timer.totalTimeISO;

    // this is need to refresh the view when being revisited from changed in interval-settings
    this.ngDectector.detectChanges();
  }

  subscribeTimer(): void {
    this.subscription = this.timer.publication.subscribe(
      (e: any) => {
        // play sound each second for getReady states
        if ((e.state & (IntervalState.Start + IntervalState.Instant)) == (IntervalState.Start + IntervalState.Instant) ||
          ((e.state & IntervalState.ActiveWarning) == IntervalState.ActiveWarning)) {
          this.signal.single();
        } else if ((e.state & (IntervalState.GetReady + IntervalState.Instant)) == (IntervalState.GetReady + IntervalState.Instant)) {
          this.signal.double();
        } else if (e.state == IntervalState.Completed) {
          this.signal.triple();
          this.insomnia.allowSleepAgain();
        }

        //console.log(e.state);

        // TODO: this is indicitive to poor code design.  UI is expecting a specific
        // type but we are subscribe with rxjs for two types.
        if (e.currentInterval !== undefined) {
          this.currentInterval = (e as IIntervalEmission).currentInterval;
          this._state = (e as IIntervalEmission).state;
          this.remainingIntervalTime = (e as IIntervalEmission).remainingIntervalTime;
          this.remainingTime = e.remainingTime;
        } else {
          this._state = IntervalState.Countdown;
          this.remainingTime = e.remainingTime;
        }
      }, (error) => {
        //console.log(error);
        this._state = IntervalState.Error;
      }, () => {
        // TODO: this never gets hit.  AnotherIntervalTimer is not emitting Completed.
        //this.signal.triple();
        //this._state = IntervalState.Completed;
        //this.remainingTime = this.timer.totalTimeISO;
      });
  }

  setRunningFeatures() {
    this.menuCtrl.enable(false, 'left');
    this.menuCtrl.enable(false, 'right');
    this.insomnia.keepAwake();
  }

  setNotRunningFeatures() {
    this.menuCtrl.enable(true, 'left');
    this.menuCtrl.enable(true, 'right');
    this.insomnia.allowSleepAgain();
  }

  onAction(emission: FabEmission) {
    switch (emission.action) {
      case FabAction.Home:
        this.timer.pause();
        this.setNotRunningFeatures();
        this.menuCtrl.open("left");
        break;
      case FabAction.Start:
        this.timer.play();
        this.setRunningFeatures();
        break;
      case FabAction.Pause:
        this.timer.pause();
        this.setNotRunningFeatures();
        break;
      case FabAction.Reset:
        this.instantiateTimer();
        this.setNotRunningFeatures();
        break;
      case FabAction.Program:
        this.timer.pause();
        this.setNotRunningFeatures();
        this.menuCtrl.open("right");
        break;
    }
    emission.container.close();
  }
}

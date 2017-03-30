import { Component, NgZone } from '@angular/core';

import { NavController, Platform } from 'ionic-angular';

import { DeviceOrientation, DeviceOrientationCompassHeading } from 'ionic-native';

import 'leaflet';
import 'leaflet-rotatedmarker';

declare var pedometer;

@Component({
  selector: 'page-about',
  templateUrl: 'about.html',
  styleUrls: [
    // 'src/pages/about/leaflet.css'
  ],
})
export class AboutPage {
  zone:NgZone;
  public stepCounter = 0;
  public orientation = 0;

  constructor(public navCtrl: NavController, public platform: Platform) {
    this.zone = new NgZone({enableLongStackTrace: false});
  }

  ngOnInit(): void {
   var map = L.map('map')
      .setView([21.505, -0.09], 1);

   L.tileLayer('assets/floorplan/2f/{z}/{x}/{y}.png', {
      attributionControl: false,
      maxZoom: 5,
      minZoom: 0,
      zoom: 0,
      noWrap: true,
      accessToken: 'xxx'
    }).addTo(map);

    var currentMarkerIcon = L.icon({
        iconUrl: 'assets/images/current_marker.png',
        iconSize: [38, 38], // size of the icon
        popupAnchor: [-3, -76] // point from which the popup should open relative to the iconAnchor
    });

    var currentMarker = L.marker(map.getCenter(), { icon: currentMarkerIcon }).addTo(map);
    currentMarker.setRotationOrigin('center');
    currentMarker.setRotationAngle(0);

    this.platform.ready().then(() => {
      console.log("MyApp::constructor platform.ready");
      pedometer.startPedometerUpdates((pedometerData) => {
        // console.log(pedometerData);
        // pedometerData.startDate; -> ms since 1970
        // pedometerData.endDate; -> ms since 1970
        // pedometerData.numberOfSteps;
        // pedometerData.distance;
        // pedometerData.floorsAscended;
        // pedometerData.floorsDescended;
        this.zone.run(() => {
          let stepDiff = pedometerData.numberOfSteps - this.stepCounter;
          this.stepCounter = pedometerData.numberOfSteps;
          // console.log('Updated List: ', this.stepCounter);
          const tmpLat = currentMarker.getLatLng().lat;
          const tmpLng = currentMarker.getLatLng().lng;
          console.log({stepDiff: stepDiff, x: stepDiff * Math.cos(this.toRadians(this.orientation)), y: stepDiff + Math.sin(this.toRadians(this.orientation)), ori: this.orientation, oldLat: tmpLat, oldLng: tmpLng, newLat: tmpLat + 0.25 * stepDiff * Math.cos(this.toRadians(this.orientation)), newLng: tmpLng + 0.25 * stepDiff + Math.sin(this.toRadians(this.orientation))});
          const newLatLng = L.latLng([tmpLat + 0.25 * stepDiff * Math.cos(this.toRadians(this.orientation)), tmpLng + 0.25 * stepDiff + Math.sin(this.toRadians(this.orientation))]);
          currentMarker.setLatLng(newLatLng).update();
          map.setView([21.505, -0.09], map.getZoom());
        });
      }, (err) => {
        console.log(err);
      });

      var subscription = DeviceOrientation.watchHeading().subscribe(
        (data: DeviceOrientationCompassHeading) => {
          this.zone.run(() => {
            this.orientation = data.trueHeading;
            currentMarker.setRotationAngle(data.trueHeading);
          });
        }
      );

    });
  }

  toRadians(angle) {
    return angle * (Math.PI / 180);
  }

}

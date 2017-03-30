import { Component, NgZone } from '@angular/core';

import { NavController, Platform } from 'ionic-angular';

declare var pedometer;

import 'leaflet';
import 'leaflet-rotatedmarker';
import 'leaflet-draw';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  zone:NgZone;
  public stepCounter = 0;

  constructor(public navCtrl: NavController, public platform: Platform) {
    this.zone = new NgZone({enableLongStackTrace: false});
    // this.platform = platform;
  }

  ngOnInit(): void {
    var map = L.map('map1', { measureControl: true, drawControl: true })
       .setView([21.505, -0.09], 1);

    const layer = L.tileLayer('assets/floorplan/2f/{z}/{x}/{y}.png', {
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

     var drawnItems = new L.FeatureGroup([]);
     map.addLayer(drawnItems);
  }

  testPedometer(): void {
    this.platform.ready().then(() => {
      console.log("MyApp::constructor platform.ready");
      pedometer.startPedometerUpdates((pedometerData) => {
        console.log(pedometerData);
        // pedometerData.startDate; -> ms since 1970
        // pedometerData.endDate; -> ms since 1970
        // pedometerData.numberOfSteps;
        // pedometerData.distance;
        // pedometerData.floorsAscended;
        // pedometerData.floorsDescended;
        this.zone.run(() => {
          this.stepCounter = pedometerData.numberOfSteps;
          console.log('Updated List: ', this.stepCounter);
        });

      }, (err) => {
        console.log(err);
      });
    });

  }

}

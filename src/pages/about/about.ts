import { Component } from '@angular/core';

import { NavController } from 'ionic-angular';

import 'leaflet';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html',
  styleUrls: [
    'https://unpkg.com/leaflet@1.0.3/dist/leaflet.css'
  ],
})
export class AboutPage {

  constructor(public navCtrl: NavController) {

  }

  ngOnInit(): void {
   var map = L.map('map')
      .setView([51.505, -0.09], 13);

   L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
      maxZoom: 18,
      accessToken: 'xxx'
    }).addTo(map);

}

}

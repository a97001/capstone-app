import { Component, NgZone, ViewChild } from '@angular/core';

import { NavController, Platform } from 'ionic-angular';

// import * as KerasJS from "keras-js";
declare var CameraPreview: any;
declare var cordovaHTTP: any;

@Component({
  selector: 'page-contact',
  templateUrl: 'contact.html'
})
export class ContactPage {
  zone:NgZone;
  imageUrl = '';
  @ViewChild('layout') canvasRef;
  constructor(public navCtrl: NavController, public platform: Platform) {
    this.imageUrl = '';
    this.zone = new NgZone({enableLongStackTrace: false});
  }

  ngOnInit(): void {
    let body = document.getElementsByTagName('body')[0];
    // body.classList.remove("className");   //remove the class
    body.classList.add("transparentClass");   //add the class
    let html = document.getElementsByTagName('html')[0];
    html.classList.add("transparentClass");   //add the class
    let ion_app = document.getElementsByTagName('ion-app')[0];
    ion_app.classList.add("transparentClass");   //add the class
    let contact = document.getElementsByTagName('page-contact');
    console.log(contact.length);
    let ion_content = contact[0].getElementsByTagName("ion-content");
    console.log(ion_content.length);
    for (let x = 0; x < ion_content.length; x++) {
      ion_content[x].classList.add("transparentClass");   //add the class
    }

    let ion_page = document.getElementsByTagName('ion-page');
    console.log(ion_page.length);
    for (let x = 0; x < ion_page.length; x++) {
      ion_page[x].classList.add("transparentClass");   //add the class
    }
    this.platform.ready().then(() => {
        CameraPreview.startCamera({ x: 0, y: 0, width: this.platform.width(), height: this.platform.height(), camera: 'rear', toBack: true }, () => {
          console.log('start Cam');
        });
    });
  }

  capture(): void {
    this.platform.ready().then(() => {
      CameraPreview.takePicture((base64PictureData) => {
        console.log('take pic');
        const imageSrcData = 'data:image/jpeg;base64,' + base64PictureData;
        this.imageUrl = imageSrcData;
        CameraPreview.hide();
        CameraPreview.stopCamera();
        let body = document.getElementsByTagName('body')[0];
        body.classList.remove("transparentClass");   //add the class
        let html = document.getElementsByTagName('html')[0];
        html.classList.remove("transparentClass");   //add the class
        let ion_app = document.getElementsByTagName('ion-app')[0];
        ion_app.classList.remove("transparentClass");   //add the class
        let contact = document.getElementsByTagName('page-contact');
        console.log(contact.length);
        let ion_content = contact[0].getElementsByTagName("ion-content");
        console.log(ion_content.length);
        for (let x = 0; x < ion_content.length; x++) {
          ion_content[x].classList.remove("transparentClass");   //add the class
        }

        let ion_page = document.getElementsByTagName('ion-page');
        console.log(ion_page.length);
        for (let x = 0; x < ion_page.length; x++) {
          ion_page[x].classList.remove("transparentClass");   //add the class
        }
        let canvas = this.canvasRef.nativeElement;
        let context = canvas.getContext('2d');
        let source = new Image();
        source.src = imageSrcData;
        canvas.height = source.height;
        canvas.width = source.width;
        context.drawImage(source, 0, 0, 200, 300);
        cordovaHTTP.post('http://192.168.1.117:5000/recognizers', { image: base64PictureData }, {} , (data) => {
          console.log(data.status);
          console.log(data.data); // data received by server
          console.log(data.headers);

        }, (err) => {
          console.log(err.status);
          console.log(err.error); // error message as string
          console.log(err.headers);

        });
      });
    });
  }

}

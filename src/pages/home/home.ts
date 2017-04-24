import { Component, ViewChild, ElementRef  } from '@angular/core';
import { Http, Headers } from '@angular/http';
import { NavController, Platform, LoadingController, AlertController, ToastController  } from 'ionic-angular';
import { DeviceOrientation, DeviceOrientationCompassHeading } from '@ionic-native/device-orientation';
import 'rxjs/add/operator/map';

declare var L;
declare var cordovaHTTP: any;
declare var CameraPreview: any;
declare var pedometer;
declare var THREE;
declare var navigator;
declare var EventsControls;

const PRESSURE_STANDARD_ATMOSPHERE = 1013.25;
const FLOOR_HEIGHT_THRESHOLD = 2.7;
const FLOOR_CHANGE_THRESHOLD = 1
const DISTANCE_THRESHOLD = 2.5;
const MAP_RATIO = 8.752009 / 7.0104;
let userHeight = 175;
let footStepLength = 175 * 0.415 / 100;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild('layout') canvasRef;
  facilityType = 'All';
  jwt = null;
  facilities = [];
  map: any;
  layer2F: any;
  layer3F: any;
  currentFloor = 2;
  currentLocationMarker = null;
  orientation = 0;
  orientationSubscription = null;
  stepCounter = 0;
  isPedometerStared = false;
  currentFacility = null;
  currentPathway = null;
  pointList = []
  destination = null;
  isShortestPath = false;
  nearestPoint = [];
  isARMode = false;
  controls: any;
  renderer: any;
  oldHeight = null;
  referenceHeight = null;
  preferVerticalMethod = 'esc';

  constructor(public navCtrl: NavController, public platform: Platform, public http: Http, public loadingCtrl: LoadingController, public deviceOrientation: DeviceOrientation, public alertCtrl: AlertController, public toastCtrl: ToastController) {
  }

  ngOnInit(): void {
    this.map = L.map('map', { crs: L.CRS.Simple, zoomControl: false }).setView([21.505, -0.09], 2);
    this.layer2F = L.tileLayer('assets/floorplan/2f/{z}/{x}/{y}.png', {
      attributionControl: false,
      maxZoom: 5,
      minZoom: 0,
      zoom: 0,
      noWrap: true
    });
    this.layer3F = L.tileLayer('assets/floorplan/3f/{z}/{x}/{y}.png', {
      attributionControl: false,
      maxZoom: 5,
      minZoom: 0,
      zoom: 0,
      noWrap: true
    });

    this.map.addLayer(this.layer2F);

    var mapBounds = new L.LatLngBounds(this.map.unproject([0, 5888], 5), this.map.unproject([8192, 0], 5));
    this.map.fitBounds(mapBounds);

    this.http.post('http://root:@tyt06326.no-ip.org:8529/_open/auth', { username:"root", password:"" }, {}).map(res => res.json()).subscribe(data => {
      console.log(data);
      this.jwt = new Headers();
      this.jwt.append('Authorization', 'bearer ' + data.jwt);
      this.getAllFacilities();
    }, err => {
      console.log("ERROR!: ", err);
    });

    this.platform.ready().then(() => {
      let goingUpMsg = this.loadingCtrl.create({
        content: 'Your are going up...'
      });
      let goingDownMsg = this.loadingCtrl.create({
        content: 'Your are going down...'
      });
      var watchID = navigator.barometer.watchPressure((pressure) => {
        var currentHeight = 44330 * (1 - Math.pow(( pressure.val / PRESSURE_STANDARD_ATMOSPHERE ), 1 / 5.255));
        if (this.oldHeight) {
            currentHeight = 0.1 * currentHeight + (1 - 0.1) * this.oldHeight;
            // document.getElementById('bar').innerHTML = "bar: " + pressure.val + ", <br>height: " + currentHeight + ", <br>different: " + (currentHeight - this.oldHeight);
            if (this.referenceHeight) {
              if (this.referenceHeight - this.oldHeight > FLOOR_HEIGHT_THRESHOLD) {
                goingDownMsg.dismiss();
                this.switchFloor(2);
                this.referenceHeight = this.oldHeight;
                if (this.preferVerticalMethod === 'esc') {
                  this.currentLocationMarker.setLatLng([-62, 111.75]).update();
                } else {
                  this.currentLocationMarker.setLatLng([-105.75, 97.375]).update();

                }
              } else if (this.referenceHeight - this.oldHeight < -FLOOR_HEIGHT_THRESHOLD) {
                goingUpMsg.dismiss();
                this.switchFloor(3);
                this.referenceHeight = this.oldHeight;
                if (this.preferVerticalMethod === 'esc') {
                  this.currentLocationMarker.setLatLng([-88.375, 113.75]).update();
                } else {
                  this.currentLocationMarker.setLatLng([-113.75, 100]).update();


                }
              } else if (this.referenceHeight - this.oldHeight > FLOOR_CHANGE_THRESHOLD) {
                goingDownMsg.present();
              } else if (this.referenceHeight - this.oldHeight < -FLOOR_CHANGE_THRESHOLD) {
                goingUpMsg.present();
              }
            }
        }
        this.oldHeight = currentHeight;
      }, (err) => {
        console.log(err);
      }, { frequency: 220 });
    });

  }

  getAllFacilities(): void {
    this.http.post('http://root:@tyt06326.no-ip.org:8529/_db/capstone/_api/cursor', { query: "FOR facility IN facilities SORT facility.regNo RETURN { facility: facility, waypoint : (FOR waypoint IN waypoint FILTER facility.waypoint == waypoint._id RETURN waypoint)}", batchSize: 2000 }, { headers: this.jwt }).map((res) => res.json()).subscribe((data) => {
      console.log(data);
      this.facilities = data.result;
      data.result.forEach((facility) => {
        facility.facility.distance = '--';
        var icon = L.icon({
          iconUrl: 'assets/images/icons/' + facility.facility.icon,
          iconSize: facility.facility.iconSize, // size of the icon
        });
        var marker = L.marker(facility.facility.coordinates, { icon: icon });
        var popup = "<table><tr><td>Name: " + facility.facility.name + "</td></tr><tr><td>Type: " + facility.facility.type + "</td></tr></table>"
        marker.bindPopup(popup);
        if (facility.facility.floor === this.currentFloor) {
          marker.addTo(this.map);
        }
        facility.facility.instance = marker;
      });
    }, err => {
      console.log("ERROR!: ", err);
    });
  }

  locateFacility(i: any): void {
    document.getElementById('mapContainer').classList.remove('displayNoneClass');
    document.getElementById('logoContainer').classList.add('displayNoneClass');
    this.map.invalidateSize(true);
    this.switchFloor(this.facilities[i].facility.floor);
    this.map.setView(this.facilities[i].facility.coordinates, 3);
    this.facilities.forEach((facility) => {
      if (facility.facility.instance.classList) {
        facility.facility.instance.disablePermanentHighlight();
      }
    });
    this.facilities[i].facility.instance.enablePermanentHighlight();
  }

  getCurrentLocation(): void {
    this.isShortestPath = false;
    this.openCamera();
  }

  openCamera(): void {
    let body = document.getElementsByTagName('body')[0];
    body.classList.add("transparentClass");   //add the class
    let html = document.getElementsByTagName('html')[0];
    html.classList.add("transparentClass");   //add the class
    let ion_app = document.getElementsByTagName('ion-app')[0];
    ion_app.classList.add("transparentClass");   //add the class
    let home = document.getElementsByTagName('page-home');
    let ion_content = home[0].getElementsByTagName("ion-content");
    console.log(ion_content.length);
    for (let x = 0; x < ion_content.length; x++) {
      ion_content[x].classList.add("transparentClass");   //add the class
    }
    document.getElementById('upper').classList.add('displayNoneClass');
    document.getElementById('lower').classList.add('displayNoneClass');
    document.getElementById('arToggle').classList.add('displayNoneClass');
    document.getElementById('camera').classList.remove('displayNoneClass');
    this.platform.ready().then(() => {
      CameraPreview.startCamera({ x: 0, y: 0, width: this.platform.width(), height: this.platform.height(), camera: 'rear', toBack: true }, () => {
        console.log('start Cam');
      });
    });
  }

  closeCamera(): void {
    CameraPreview.hide();
    CameraPreview.stopCamera();
    document.getElementById('camera').classList.add('displayNoneClass');
    document.getElementById('upper').classList.remove('displayNoneClass');
    document.getElementById('lower').classList.remove('displayNoneClass');
    let body = document.getElementsByTagName('body')[0];
    body.classList.remove("transparentClass");   //add the class
    let html = document.getElementsByTagName('html')[0];
    html.classList.remove("transparentClass");   //add the class
    let ion_app = document.getElementsByTagName('ion-app')[0];
    ion_app.classList.remove("transparentClass");   //add the class
    let home = document.getElementsByTagName('page-home');
    let ion_content = home[0].getElementsByTagName("ion-content");
    console.log(ion_content.length);
    for (let x = 0; x < ion_content.length; x++) {
      ion_content[x].classList.remove("transparentClass");   //add the class
    }
    if (this.currentPathway) {
      document.getElementById('arToggle').classList.remove('displayNoneClass');
    }
  }

  captureCamera(): void {
    CameraPreview.takePicture({ width: 1280, height: 720, quality: 85 }, (base64PictureData) => {
      console.log('take pic');
      this.closeCamera();
      const imageSrcData = 'data:image/jpeg;base64,' + base64PictureData;
      let loading = this.loadingCtrl.create({
        content: 'Finding your location...'
      });
      loading.present();
      cordovaHTTP.post('http://tyt06326.no-ip.org:5000/recognizers', { image: base64PictureData }, {} , (data) => {
        var regNo = JSON.parse(data.data)[0];
        console.log("regNo: " + regNo);
        for (let i = 0; i < this.facilities.length; i++) {
          let item = this.facilities[i];
          if (item.facility.regNo === regNo) {
            if (item.waypoint.length > 0) {
              this.currentFacility = item;
              console.log('test');
              console.log(item.waypoint);
              this.switchFloor(item.facility.floor);
              var currentMarkerIcon = L.icon({
                iconUrl: 'assets/images/current_marker.png',
                iconSize: [38, 38], // size of the icon
                popupAnchor: [-3, -76] // point from which the popup should open relative to the iconAnchor
              });
              if (this.currentLocationMarker) {
                this.currentLocationMarker.setLatLng(item.waypoint[0].coordinates).update();
              } else {
                this.currentLocationMarker = L.marker(item.waypoint[0].coordinates, { icon: currentMarkerIcon }).addTo(this.map);
                this.currentLocationMarker.setRotationOrigin('center');
              }
              if (!this.orientationSubscription) {
                this.orientationSubscription = this.deviceOrientation.watchHeading().subscribe((data: DeviceOrientationCompassHeading) => {
                  this.orientation = data.trueHeading - 25;
                  this.currentLocationMarker.setRotationAngle(this.orientation);
                });
              }

              this.map.setView(item.waypoint[0].coordinates, 3);
              this.updateFacilityDistance();
              if (!this.isPedometerStared) {
                pedometer.startPedometerUpdates((pedometerData) => {
                  // console.log(pedometerData);
                  this.isPedometerStared = true;
                  let stepDiff = 1;
                  this.stepCounter = pedometerData.numberOfSteps;
                  // console.log('Updated List: ', this.stepCounter);
                  const tmpLat = this.currentLocationMarker.getLatLng().lat;
                  const tmpLng = this.currentLocationMarker.getLatLng().lng;
                  // console.log({stepDiff: stepDiff, x: stepDiff * Math.sin(this.toRadians(this.orientation)), y: stepDiff + Math.cos(this.toRadians(this.orientation)), ori: this.orientation, oldLat: tmpLat, oldLng: tmpLng, newLat: tmpLat + 1.191628522 * stepDiff * Math.sin(this.toRadians(this.orientation)), newLng: tmpLng + 1.191628522 * stepDiff + Math.cos(this.toRadians(this.orientation))});
                  const newLatLng = L.latLng([tmpLat + (MAP_RATIO * footStepLength) * stepDiff * Math.cos(this.toRadians(this.orientation)), tmpLng + (MAP_RATIO * footStepLength) * stepDiff * Math.sin(this.toRadians(this.orientation))]);
                  this.currentLocationMarker.setLatLng(newLatLng).update();
                  this.map.setView(newLatLng, this.map.getZoom());
                  this.updateFacilityDistance();
                  if (this.destination && this.destination.facility.distance < DISTANCE_THRESHOLD) {
                    this.arrived();
                  }
                }, (err) => {
                  console.log(err);
                });
              }
              if (this.isShortestPath) {
                this.getShortestPath()
              }
              this.referenceHeight = this.oldHeight;
            }
          }
        }
        loading.dismiss();
      }, (err) => {
        console.log(err.status);
        console.log(err.error); // error message as string
        console.log(err.headers);
        this.currentFacility = null;
        loading.dismiss();
      });
    });
  }

  setDestination(i: any) {
    document.getElementById('mapContainer').classList.remove('displayNoneClass');
    document.getElementById('logoContainer').classList.add('displayNoneClass');
    this.map.invalidateSize(true);
    this.destination = this.facilities[i];
    console.log('setDestination');
    this.isShortestPath = true;
    this.openCamera();
  }

  getShortestPath(): void {
    let vertical = ' OPTIONS { weightAttribute: "distance"} ';
    if (this.preferVerticalMethod === 'esc') {
      vertical = '';
    }
    console.log(vertical)
    this.http.post('http://root:@tyt06326.no-ip.org:8529/_db/capstone/_api/cursor', { query: 'FOR vertex IN ANY SHORTEST_PATH "' + this.currentFacility.waypoint[0]._id + '" TO "' + this.destination.waypoint[0]._id + '" GRAPH "pathway"' + vertical + ' RETURN vertex', batchSize: 2000 }, { headers: this.jwt }).map((res) => res.json()).subscribe((data) => {
      console.log(data);
      let pointList = [];
      this.pointList = [];
      data.result.forEach((waypoint) => {
        pointList.push(waypoint.coordinates);
        this.pointList.push(waypoint.coordinates);
      });
      if (this.currentPathway) {
        this.map.removeLayer(this.currentPathway);
      }
      var filteredPointList = pointList.filter((point) => point[2] === this.currentFloor);
      this.currentPathway = L.polyline.antPath(filteredPointList, {
          color: 'red',
          weight: 3,
          opacity: 0.5,
          smoothFactor: 1,
          delay: 50
      }).addTo(this.map);
      document.getElementById('arToggle').classList.remove('displayNoneClass');
    }, err => {
      console.log("ERROR! ", err);
    });
  }

  arrived(): void {
    if (this.currentPathway) {
      this.map.removeLayer(this.currentPathway);
    }
    document.getElementById('arToggle').classList.add('displayNoneClass');
    this.showArrivedMsg(this.destination.facility);
    this.destination = null;
    this.endARMode();
  }

  onARModeChanged(event: any): void {
    if (this.isARMode) {
      setTimeout(() => this.startARMode(), 200);
    } else {
      this.endARMode();
    }
  }

  startARMode(): void {
    let body = document.getElementsByTagName('body')[0];
    body.classList.add("transparentClass");   //add the class
    let html = document.getElementsByTagName('html')[0];
    html.classList.add("transparentClass");   //add the class
    let ion_app = document.getElementsByTagName('ion-app')[0];
    ion_app.classList.add("transparentClass");   //add the class
    let home = document.getElementsByTagName('page-home');
    let ion_content = home[0].getElementsByTagName("ion-content");
    console.log(ion_content.length);
    for (let x = 0; x < ion_content.length; x++) {
      ion_content[x].classList.add("transparentClass");   //add the class
    }
    document.getElementById('upper').classList.add('displayNoneClass');
    document.getElementById('lower').classList.add('displayNoneClass');
    document.getElementById('arContainer').classList.remove('displayNoneClass');
    this.platform.ready().then(() => {
      CameraPreview.startCamera({ x: 0, y: 0, width: this.platform.width(), height: this.platform.height(), camera: 'rear', toBack: true }, () => {
        console.log('start Cam');
        this.createAREnvironment();
      });
    });
  }

  endARMode(): void {
    this.destroyAREnvironment();
    CameraPreview.hide();
    CameraPreview.stopCamera();
    document.getElementById('arContainer').classList.add('displayNoneClass');
    document.getElementById('upper').classList.remove('displayNoneClass');
    document.getElementById('lower').classList.remove('displayNoneClass');
    let body = document.getElementsByTagName('body')[0];
    body.classList.remove("transparentClass");   //add the class
    let html = document.getElementsByTagName('html')[0];
    html.classList.remove("transparentClass");   //add the class
    let ion_app = document.getElementsByTagName('ion-app')[0];
    ion_app.classList.remove("transparentClass");   //add the class
    let home = document.getElementsByTagName('page-home');
    let ion_content = home[0].getElementsByTagName("ion-content");
    console.log(ion_content.length);
    for (let x = 0; x < ion_content.length; x++) {
      ion_content[x].classList.remove("transparentClass");   //add the class
    }
  }

  createAREnvironment(): void {
			var container, camera, scene, geometry, mesh, mouse, raycaster, arrows = [], facilities = [], floor = this.currentFloor, flag = null;

			container = document.getElementById( 'arContainer' );

			camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 110);

			camera.position.x = this.currentLocationMarker.getLatLng().lat;
			camera.position.y = 3;
			camera.position.z = this.currentLocationMarker.getLatLng().lng;

      // camera.rotation.y = (-this.orientation * Math.PI / 180);

			this.controls = new THREE.DeviceOrientationControls( camera );
      this.controls.updateAlphaOffsetAngle(THREE.Math.degToRad(180 -this.orientation));

			scene = new THREE.Scene();

      var changeFloor = () => {
        for (let i = 0; i < arrows.length; i++) {
          scene.remove(arrows[i]);
        }
        arrows = [];
        var loader = new THREE.OBJLoader();
        loader.load('assets/images/arrow.obj', (object) => {
          var material = new THREE.MeshPhysicalMaterial( {color: new THREE.Color( 1, 0, 0 ) } );
          object.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
              child.material = material;
            }
          });
          object.scale.set(2, 2, 4);
          object.castShadow = true;
          for (let i = 0; i < this.pointList.length - 1; i++) {
            if (this.pointList[i][2] === floor) {
              let point = this.pointList[i];
              let point1 = this.pointList[i + 1];
              console.log(point, point1);
              let bearing = L.GeometryUtil.bearing(L.latLng(point[0], point[1]), L.latLng(point1[0], point1[1]));
              let angle = L.GeometryUtil.computeAngle(L.point(point[0], point[1]), L.point(point1[0], point1[1]));
              var newObject = object.clone();
              newObject.position.set(point[0], 3, point[1]);
              newObject.rotation.y = (-angle * Math.PI / 180);
              newObject.name = 'test name';
              scene.add(newObject);
              arrows.push(newObject);
            }
          }
        });
        loader.load('assets/images/end.obj', (object) => {
          var material = new THREE.MeshPhysicalMaterial( {color: new THREE.Color( 0, 1, 0 ) } );
          object.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
              child.material = material;
            }
          });
          // object.scale.set(1.5, 1.5, 1.5);
          object.castShadow = true;
          for (let i = 0; i < this.facilities.length - 1; i++) {
            if (this.facilities[i].facility.floor === floor) {
              // let point = this.pointList[i];
              // let point1 = this.pointList[i + 1];
              // console.log(point, point1);
              // let bearing = L.GeometryUtil.bearing(L.latLng(point[0], point[1]), L.latLng(point1[0], point1[1]));
              // let angle = L.GeometryUtil.computeAngle(L.point(point[0], point[1]), L.point(point1[0], point1[1]));
              var newObject = object.clone();
              newObject.position.set(this.facilities[i].facility.coordinates[0], 3, this.facilities[i].facility.coordinates[1]);
              // newObject.rotation.y = (-angle * Math.PI / 180);
              newObject.name = i;
              scene.add(newObject);
              facilities.push(newObject);
            }
          }
        });
        loader.load('assets/images/flag.obj', (object) => {
          var material = new THREE.MeshPhysicalMaterial( {color: new THREE.Color( 1, 1, 0 ) } );
          object.traverse( function ( child ) {
            if ( child instanceof THREE.Mesh ) {
              child.material = material;
            }
          });
          object.scale.set(0.5, 0.5, 0.5);
          object.castShadow = true;
          object.rotation.x = (-90 * Math.PI / 180);
          object.position.set(this.pointList[this.pointList.length - 1][0], 0, this.pointList[this.pointList.length - 1][1]);
          flag = object;
          scene.add(object);
        });
      };

      // scene.add(cube);

			// var size = 10000;
			// var divisions = 10000;
      //
			// var gridHelper = new THREE.GridHelper( size, divisions );
			// scene.add( gridHelper );

      // var radius = 1000;
      // var radials = 16;
      // var circles = 80;
      // var divisions = 64;
      // var helper = new THREE.PolarGridHelper( radius, radials, circles, divisions );
      // scene.add( helper );

      var light = new THREE.HemisphereLight( 0xffffbb, 0x080820, 1 );
			scene.add( light );
			var directionalLight = new THREE.SpotLight( 0xffffff );
			directionalLight.shadowDarkness = 0.5;
      directionalLight.shadowCameraNear = camera.near;
      directionalLight.shadowCameraFar = camera.far;
      directionalLight.castShadow = true;
      directionalLight.shadowDarkness  = 0.5;
      directionalLight.shadowMapWidth  = 10240;
      directionalLight.shadowMapHeight = 10240;
      directionalLight.shadowCameraFov = 450;
      directionalLight.shadowCameraVisible = true;
			directionalLight.position.set(0, 1000, 0);
			scene.add( directionalLight );

      changeFloor();

			this.renderer = new THREE.WebGLRenderer({ alpha: true });
			this.renderer.setPixelRatio( window.devicePixelRatio );
			this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor( 0x000000, 0 );
			this.renderer.domElement.style.position = 'absolute';
			this.renderer.domElement.style.top = 0;
			container.appendChild(this.renderer.domElement);

      var renderer = this.renderer;
      raycaster = new THREE.Raycaster();
      mouse = new THREE.Vector2();

      var onDocumentTouchStart = (event) => {
        event.preventDefault();
        event.clientX = event.touches[0].clientX;
        event.clientY = event.touches[0].clientY;
        onDocumentMouseDown(event);
      }

      var onDocumentMouseDown = (event) => {
        event.preventDefault();
        mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        var intersects = raycaster.intersectObjects(facilities, true);
        if ( intersects.length > 0 ) {
          if (this.facilities[intersects[0].object.parent.name]) {
            console.log(intersects[0].object.parent.name);
            this.showFacilityAlert(this.facilities[intersects[0].object.parent.name].facility);
          }
          // intersects[ 0 ].object.material.color.setHex( Math.random() * 0xffffff );
          // var particle = new THREE.Sprite( particleMaterial );
          // particle.position.copy( intersects[ 0 ].point );
          // particle.scale.x = particle.scale.y = 16;
          // scene.add( particle );
        }
      }


      // document.addEventListener( 'mousedown', onDocumentMouseDown, false );
			document.addEventListener( 'touchstart', onDocumentTouchStart, false );

      var animate = () => {
        window.requestAnimationFrame( animate );
        // this.controls.updateAlphaOffsetAngle(this.orientation * Math.PI / 180);
        this.controls.update();
        for (let i = 0; i < arrows.length; i++) {
          arrows[i].rotateX(0.01);
        }
        for (let i = 0; i < facilities.length; i++) {
          facilities[i].rotateY(0.05);
        }
        camera.position.x = this.currentLocationMarker.getLatLng().lat;
  			camera.position.y = 3;
  			camera.position.z = this.currentLocationMarker.getLatLng().lng;
        if (floor !== this.currentFloor) {
          floor = this.currentFloor;
          changeFloor();
        }
        raycaster.setFromCamera(mouse, camera);
        this.renderer.render(scene, camera);

      };

			// window.addEventListener('resize', function() {
      //
			// 	camera.aspect = window.innerWidth / window.innerHeight;
			// 	camera.updateProjectionMatrix();
			// 	renderer.setSize( window.innerWidth, window.innerHeight );
      //
			// }, false);
			animate();
  }

  destroyAREnvironment() {
    this.controls.disconnect();
    this.renderer.dispose();
    var arContainer = document.getElementById("arContainer");
    while (arContainer.firstChild) {
        arContainer.removeChild(arContainer.firstChild);
    }
  }

  switchFloor(i: any): void {
    if (this.currentFloor == i) {
      return;
    }
    this.facilities.forEach((facility) => {
      if (facility.facility.floor === this.currentFloor) {
        this.map.removeLayer(facility.facility.instance);
      } else if (facility.facility.floor === i) {
        facility.facility.instance.addTo(this.map);
      }
    });
    if (i == 2) {
      this.map.removeLayer(this.layer3F);
      this.map.addLayer(this.layer2F);
      if (this.preferVerticalMethod === 'esc') {
        this.map.setView([-62, 111.75], this.map.getZoom());
      } else {
        this.map.setView([-105.75, 97.375], this.map.getZoom());
      }
      let toast = this.toastCtrl.create({
        message: 'Changed to 2F...',
        duration: 2000,
        position: 'bottom'
      });
      toast.present();
    } else {
      this.map.removeLayer(this.layer2F);
      this.map.addLayer(this.layer3F);
      if (this.preferVerticalMethod === 'esc') {
        this.map.setView([-88.375, 113.75], this.map.getZoom());
      } else {
        this.map.setView([-113.75, 100], this.map.getZoom());
      }
      let toast = this.toastCtrl.create({
        message: 'Changed to 3F...',
        duration: 2000,
        position: 'bottom'
      });
      toast.present();
    }
    if (this.currentPathway) {
      this.map.removeLayer(this.currentPathway);
    }
    var filteredPointList = this.pointList.filter((point) => point[2] === i);
    this.currentPathway = L.polyline.antPath(filteredPointList, {
        color: 'red',
        weight: 3,
        opacity: 0.5,
        smoothFactor: 1,
        delay: 50
    }).addTo(this.map);
    this.currentFloor = i;
  }

  showFacilityAlert(facility) {
    let alert = this.alertCtrl.create({
      title: 'Shop Detail',
      message: `        <ion-card>
                  <div class="thumbnail">
                    <img class="center-cropped" src="assets/images/facilities/${facility.image}" />
                  </div>
                  <ion-item>
                    <ion-icon name="wine" item-left large style='visibility: hidden;'></ion-icon>
                    <h2>${facility.name}</h2>
                    <p>L${facility.floor} ${facility.shopNo}</p>
                    <p>Tel. ${facility.tel}  ${facility.openingTime}</p>
                  </ion-item>

                  <ion-item>
                    <!-- <span item-left>18 min</span> -->
                    <span item-left>8.1 m</span>
                  </ion-item>
              </ion-card>`,
      buttons: ['OK']
    });
    alert.present();
  }

  showArrivedMsg(facility) {
    let alert = this.alertCtrl.create({
      title: '',
      message: `You have arrived ${facility.name}!`,
      buttons: ['OK']
    });
    alert.present();
  }

  showSettingMsg() {
    let alert = this.alertCtrl.create({
      title: 'Settings'
    });
    alert.addInput({
      type: 'radio',
      label: 'Prefer Escalator',
      value: 'esc',
      checked: true
    });
    alert.addInput({
      type: 'radio',
      label: 'Prefer Lift',
      value: 'lift',
      checked: false
    });
    alert.addButton('Cancel');
    alert.addButton({
      text: 'OK',
      handler: data => {
        this.preferVerticalMethod = data;
      }
    });

    alert.present();
  }

  updateFacilityDistance() {
    const lat = this.currentLocationMarker.getLatLng().lat;
    const lng = this.currentLocationMarker.getLatLng().lng;
    for (let i = 0; i < this.facilities.length; i++) {
      let item = this.facilities[i];
      if (item.waypoint.length > 0) {
        item.facility.distance = Math.sqrt(Math.pow(lat - item.waypoint[0].coordinates[0], 2) + Math.pow(lng - item.waypoint[0].coordinates[1], 2)) / MAP_RATIO;
        item.facility.distance = Math.round(item.facility.distance * 100) / 100;
      }
    }
  }

  toRadians(angle) {
    return angle * (Math.PI / 180);
  }

}

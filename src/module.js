class InteractiveMap {
    constructor(parent, map, config = null) {
        this.Viewport = {
            Width: parent.clientWidth,
            Height: parent.clientHeight
        }
        this.Zoom = {
            Minimum: 1,
            Maximum: 4,
            Increase: 0.5
        }
        this.Zoom.Zoom = config && config.Zoom && config.Zoom >= this.Zoom.Minimum && config.Zoom <= this.Zoom.Maximum ? config.Zoom : 1;

        this.Pan = {
            Force: 0.09,
            IsEnabled: true
        }
        this.Position = {
            x: config && config.Position ? config.Position.x : 0,
            y: config && config.Position ? config.Position.y : 0
        };
        this.Map = {
            Source: map.Map,
            AspectRatio: null,
            Horizontal: null,
            RealWorld: map.UsesRealWorld
        }
        if(this.Map.RealWorld){
            this.Map.Longitude = map.Longitude
            this.Map.Latitude = map.Latitude;
            this.Map.Area = {
                Longitude: this.Map.Longitude.End - this.Map.Longitude.Start,
                Latitude: this.Map.Latitude.Start - this.Map.Latitude.End
            }
            this.Map.Distances = {
                hor: this.GetGeographicDistance(
                    this.Map.Longitude.Start,
                    this.Map.Latitude.Start - ((this.Map.Latitude.Start - this.Map.Latitude.End) / 2),
                    this.Map.Longitude.End,
                    this.Map.Latitude.Start - ((this.Map.Latitude.Start - this.Map.Latitude.End) / 2)
                ),
                ver: this.GetGeographicDistance(
                    this.Map.Longitude.End  - ((this.Map.Latitude.End - this.Map.Latitude.Start) / 2),
                    this.Map.Latitude.Start,
                    this.Map.Longitude.End  - ((this.Map.Latitude.End - this.Map.Latitude.Start) / 2),
                    this.Map.Latitude.End
                )
            }
            this.Map.Step = 1;
            this.Map.StepSize = {
                hor: {
                    coords: this.Map.Area.Longitude / (this.Map.Distances.hor / this.Map.Step),
                    px: null
                },
                ver: {
                    coords: this.Map.Area.Latitude / (this.Map.Distances.ver / this.Map.Step),
                    px: null
                }
            }
        }
        
        this.Elements = {};
        this.Elements.Parent = parent;
        this.SynchQueue = Array();
        this.InitiatedCall = false;

        this.Markers = {};

        this.Load();
    }
    Loader() {
        var loaderElement = document.createElement('span');
            loaderElement.className = 'iamap-loader';
            loaderElement.textContent = 'Loading resources';

            this.Elements.Parent.appendChild(loaderElement);

            return loaderElement;
    }
    Load() {
        var self = this;

        var MapImageElement = new Image();
            MapImageElement.addEventListener('load', function(e){
                if(MapImageElement.width / MapImageElement.height > 1){ 
                    self.Map.Horizontal = true;
                    self.Map.AspectRatio = MapImageElement.height / MapImageElement.width;
                } else {
                    self.Map.Horizontal = false;
                    self.Map.AspectRatio = MapImageElement.width / MapImageElement.height;
                }

                self.Render();

                window.addEventListener('resize', function(e){
                    self.Render();
                });
            });
            MapImageElement.src = this.Map.Source;
    }
    Render() {
        
        // Refresh window size
        this.Viewport = {
            Width: this.Elements.Parent.clientWidth,
            Height: this.Elements.Parent.clientHeight
        }

        // Initial settings
        if(!this.Elements.Map) {
            var MElement = document.createElement('div');
                MElement.className = 'iamap-maplayer';
                MElement.style.position = 'relative';

                MElement.style.backgroundImage = "url('" + this.Map.Source + "')";
                MElement.style.backgroundRepeat = 'no-repeat';
                MElement.style.backgroundPosition = 'center center';

                MElement.style.zIndex = 50;

            this.Elements.Map = MElement;
            this.Elements.Parent.appendChild(this.Elements.Map);

            this.RunSynchQueue();

            this.CreateControllers();
        }

        // Recalculate background proportions
        if(this.Viewport.Width >= this.Viewport.Height) {
            this.Elements.Map.style.backgroundSize = '100% auto';
        } else {
            this.Elements.Map.style.backgroundSize = 'auto 100%';
        }
        
        // Manually position map if needed, turn off dragging
        if(this.Viewport.Width <= this.Viewport.Height) {
            this.Elements.Map.style.width = (this.Viewport.Width * this.Zoom.Zoom) + "px";
            this.Elements.Map.style.height = (this.Viewport.Width * this.Map.AspectRatio * this.Zoom.Zoom).toFixed(2) + "px";

            if(parseFloat(this.Elements.Map.style.height) < this.Viewport.Height) {
                let offsetY = (this.Viewport.Height - parseFloat(this.Elements.Map.style.height)).toFixed(2) / 2;
                this.Pan.IsEnabled = false;
                this.Elements.Map.style.left = "0px";
                this.Elements.Map.style.top = offsetY + "px";
            } else {
                this.Pan.IsEnabled = true;

                // Needs to be rewritten
                if(!this.Pan.mouseDrag && !this.Pan.touchDrag){
                    this.Elements.Map.style.top = "0px";
                    this.Elements.Map.style.left = "0px";
                }
            }
        } else {
            this.Elements.Map.style.height = (this.Viewport.Height * this.Zoom.Zoom) + "px";
            this.Elements.Map.style.width = (this.Viewport.Height / this.Map.AspectRatio  * this.Zoom.Zoom).toFixed(2) + "px";

            if(parseFloat(this.Elements.Map.style.width) < this.Viewport.Width) {
                let offsetX = (this.Viewport.Width - parseFloat(this.Elements.Map.style.width)).toFixed(2) / 2;
                this.Pan.IsEnabled = false;
                this.Elements.Map.style.top = "0px";
                this.Elements.Map.style.left = offsetX + "px";
            } else {
                this.Pan.IsEnabled = true;

                // Needs to be rewritten
                if(!this.Pan.mouseDrag && !this.Pan.touchDrag){
                    this.Elements.Map.style.top = "0px";
                    this.Elements.Map.style.left = "0px";
                }
            }
        }

        // Recalculate coordinates step
        let MapSize = {
            w: parseFloat(this.Elements.Map.style.width),
            h: parseFloat(this.Elements.Map.style.height)
        }

        if(!this.Map.StepSize.hor.px) {
            this.Map.StepSize.hor.px = MapSize.w / (this.Map.Distances.hor / this.Map.Step);
        }
        if(!this.Map.StepSize.ver.px) {
            this.Map.StepSize.ver.px = MapSize.h / (this.Map.Distances.ver / this.Map.Step);
        }

        // Render markers
        if(this.Markers){
            for(let g in this.Markers){
                let MarkerGroup = this.Markers[g].items;
                for(let m in MarkerGroup){
                    let Marker = MarkerGroup[m];
                    
                    // Create marker element if not available
                    if(!Marker.Element){
                        let MarkerElement = document.createElement('span');
                            MarkerElement.style.position = 'absolute';
                            MarkerElement.className = 'iamap-marker';

                            /*
                            Temporary
                            */
                            MarkerElement.style.width = "30px";
                            MarkerElement.style.height = MarkerElement.style.width;
                            MarkerElement.style.borderRadius = "calc(" + MarkerElement.style.width + " / 2)";
                            MarkerElement.style.backgroundColor = "red";

                        this.Markers[g].items[m].Element = MarkerElement;
                        this.Elements.Markers.appendChild(this.Markers[g].items[m].Element);
                    }

                    this.Markers[g].items[m].Element.style.visibility = Marker.render ? "unset" : "hidden";

                    let CoordDiff = {
                        x: Math.abs(this.Map.Longitude.Start - Marker.position.x),
                        y: Math.abs(this.Map.Latitude.Start - Marker.position.y)
                    }

                    this.Markers[g].items[m].Element.style.left = Math.abs((CoordDiff.x / this.Map.StepSize.hor.coords) * this.Map.StepSize.hor.px) * this.Zoom.Zoom + "px";
                    this.Markers[g].items[m].Element.style.top = Math.abs((CoordDiff.y / this.Map.StepSize.ver.coords) * this.Map.StepSize.ver.px) * this.Zoom.Zoom + "px";

                }

            }
        }

        return true;
    }
    CreateControllers() {
        var self = this;

        this.Elements.Controllers = {};

        var ControllersElement = document.createElement('div');
            ControllersElement.className = 'iamap-controllerslayer';
            ControllersElement.style.position = 'absolute';
            ControllersElement.style.top = 0; ControllersElement.style.left = 0;
            ControllersElement.style.zIndex = 100;
        this.Elements.Controllers.Parent = ControllersElement;
        this.Elements.Parent.appendChild(this.Elements.Controllers.Parent);

        var LocationController = document.createElement('input');
            LocationController.type = 'button';
            LocationController.value = 'My location';
            LocationController.style.position = 'relative';
            LocationController.addEventListener('click', function(e){
                e.preventDefault();
                self.MapShowCurrentLocation();
            }); 
        this.Elements.Controllers.Location = LocationController;
        this.Elements.Controllers.Parent.appendChild(this.Elements.Controllers.Location);

        var ZoomInController = document.createElement('input');
            ZoomInController.type = "button";
            ZoomInController.value = "Zoom in";
            ZoomInController.style.position = "relative";
            ZoomInController.addEventListener('click', function(e){
                e.preventDefault();
                self.MapControlZoom(true);
            });
        this.Elements.Controllers.ZoomIn = ZoomInController;
        this.Elements.Controllers.Parent.appendChild(this.Elements.Controllers.ZoomIn);

        var ZoomOutController = document.createElement('input');
            ZoomOutController.type = 'button';
            ZoomOutController.value = 'Zoom out';
            ZoomOutController.style.position = "relative";
            ZoomOutController.addEventListener('click', function(e){
                e.preventDefault();
                self.MapControlZoom(false);
            });
        this.Elements.Controllers.ZoomOut = ZoomOutController;
        this.Elements.Controllers.Parent.appendChild(this.Elements.Controllers.ZoomOut);

        this.Pan.XStart = null;
        this.Pan.YStart = null;

        this.Pan.mouseDrag = false;
        this.Pan.touchDrag = false;

        this.Elements.Map.addEventListener('touchstart', function(e){
            e.preventDefault();

            self.Pan.touchDrag = true;
            self.Pan.XStart = parseFloat((e.changedTouches[0].clientX - self.Elements.Parent.offsetLeft).toFixed(2));
            self.Pan.YStart = parseFloat((e.changedTouches[0].clientY - self.Elements.Parent.offsetTop).toFixed(2));
        });
        this.Elements.Map.addEventListener('mousedown', function(e){
            e.preventDefault();

            self.Pan.mouseDrag = true;
            self.Pan.XStart = e.clientX - self.Elements.Parent.offsetLeft;
            self.Pan.YStart = e.clientY - self.Elements.Parent.offsetTop;
        });
        this.Elements.Map.addEventListener('touchend', function(e){
            e.preventDefault();

            self.Pan.touchDrag = false;
            self.Pan.XStart = null;
            self.Pan.YStart = null;
        });
        this.Elements.Map.addEventListener('mouseup', function(e){
            e.preventDefault();

            self.Pan.mouseDrag = false;
            self.Pan.XStart = null;
            self.Pan.YStart = null;
        });
        this.Elements.Map.addEventListener('mouseleave', function(e){
            if(self.Pan.mouseDrag){
                self.Pan.mouseDrag = false;
                self.Pan.XStart = null;
                self.Pan.YStart = null;
            }
        });
        this.Elements.Map.addEventListener('mousemove', function(e){
            e.preventDefault();

            if(self.Pan.mouseDrag && self.Pan.IsEnabled){
                let cursorX = window.event.clientX;
                let cursorY = window.event.clientY;

                self.MapControlPan(cursorX, cursorY);
            }
        });
        this.Elements.Map.addEventListener('touchmove', function(e){
            e.preventDefault;

            if(self.Pan.touchDrag && self.Pan.IsEnabled){
                let cursorX = parseFloat((window.event.changedTouches[0].clientX).toFixed(2));
                let cursorY = parseFloat((window.event.changedTouches[0].clientY).toFixed(2));

                self.MapControlPan(cursorX, cursorY);
            }
        });

        // Marker controls
        for(let key in self.Markers){
            let Marker = self.Markers[key];
            if(Marker.controller === false){
                return;
            }

            var MControllerShow = document.createElement('input');
                MControllerShow.type = "button";
                MControllerShow.value = "Show group " + Marker.label;
                MControllerShow.style.positino = "relative";
                MControllerShow.addEventListener('click', function(e){
                    e.preventDefault();
                    self.ShowMarkers({
                        type: 'group',
                        group: Marker.id.toString()
                    });
                }); 
            var MControllerHide = document.createElement('input');
                MControllerHide.type = "button";
                MControllerHide.value = "Hide group " + Marker.label;
                MControllerHide.style.positino = "relative";
                MControllerHide.addEventListener('click', function(e){
                    e.preventDefault();
                    self.HideMarkers({
                        type: 'group',
                        group: Marker.id.toString()
                    });
                }); 
            

            self.Elements.Controllers["ShowGroup"+Marker.id] = MControllerShow;
            self.Elements.Controllers["HideGroup"+Marker.id] = MControllerHide;

            self.Elements.Controllers.Parent.appendChild(self.Elements.Controllers["ShowGroup"+Marker.id]);
            self.Elements.Controllers.Parent.appendChild(self.Elements.Controllers["HideGroup"+Marker.id]);
        }

        return true;
    }
    MapShowCurrentLocation(){
        var self = this;
        let Options = {
            enableHighAccuracy: true,
            maximumAge: 0
        }
        if(navigator && navigator.geolocation) {
            return navigator.geolocation.getCurrentPosition(function(res){
                let Coords = res.coords;

                if(!self.Markers.location){
                    self.AddMarkers(Array({
                        group: {
                            id: 'location',
                            slug: 'location',
                            label: 'Location',
                            icon: null,
                            controller: false
                        },
                        id: 'location',
                        label: 'My location',
                        listener: false,
                        position: {
                            x: Coords.longitude,
                            y: Coords.latitude
                        }
                    }));
                } else {
                    self.Markers.location.items.location.position = {
                        x: Coords.longitude,
                        y: Coords.latitude
                    }
                }
            }, this.MapLocationError, Options);
        } else {
            return this.MapLocationError(null);
        }
    }
    MapLocationError(e){
        switch(e.code){
            case e.PERMISSION_DENIED:
                console.log("User denied the request for Geolocation.");
                break;
            case e.POSITION_UNAVAILABLE:
                console.log("Location information is unavailable.");
                break;
            case e.TIMEOUT:
                console.log("The request to get user location timed out.");
                break;
            case e.UNKNOWN_ERROR:
            default:
                console.log("An unknown error occurred.");
                break;
        }

        return true;
    }
    MapControlZoom(ZoomIn){
        let posX = this.Position.x / this.Zoom.Zoom;
        let posY = this.Position.y / this.Zoom.Zoom;

        if(ZoomIn) {
            this.Zoom.Zoom = this.Zoom.Zoom < this.Zoom.Maximum ? this.Zoom.Zoom + this.Zoom.Increase : this.Zoom.Zoom;
        } else {
            this.Zoom.Zoom = this.Zoom.Zoom > this.Zoom.Minimum ? this.Zoom.Zoom - this.Zoom.Increase : this.Zoom.Zoom;
        }

        this.Position.x = posX * this.Zoom.Zoom;
        this.Position.y = posY * this.Zoom.Zoom;

        return this.Render();
    }
    MapControlPan(clientX, clientY){
        let hor = parseFloat((clientX - this.Pan.XStart).toFixed(2));
        let ver = parseFloat((clientY - this.Pan.YStart).toFixed(2));

        let directionX = this.Pan.XStart;
        let directionY = this.Pan.YStart;

        this.Pan.XStart = clientX;
        this.Pan.YStart = clientY;

        let offsetX = this.Elements.Map.offsetLeft ? this.Elements.Map.offsetLeft : 0;
        let offsetY = this.Elements.Map.offsetTop ? this.Elements.Map.offsetTop : 0;

        let offsetMax = {
            top: 0,
            right: (this.Elements.Map.offsetWidth - this.Viewport.Width) * -1,
            bottom: (this.Elements.Map.offsetHeight - this.Viewport.Height) * -1,
            left: 0
        }

        switch(this.Pan.XStart - directionX > 0) {
            case true:
                if(offsetX > offsetMax.left) {
                    offsetX = offsetMax.left;
                }
                break;
            case false:
                if(offsetX < offsetMax.right){
                    offsetX = offsetMax.right;
                }
                break;
        }
        switch(this.Pan.YStart - directionY > 0){
            case true:
                if(offsetY > offsetMax.top){
                    offsetY = offsetMax.top;
                }
                break;
            case false:
                if(offsetY < offsetMax.bottom){
                    offsetY = offsetMax.bottom;
                }
                break;
        }

        this.Elements.Map.style.left = parseFloat(offsetX + hor) + "px";
        this.Elements.Map.style.top = parseFloat(offsetY + ver) + "px";
    }
    AddMarkers(markers, context){
        if(!this.Elements.Map){
            return this.AddToSynchQueue('AddMarkers', this, Array(markers));
        }        

        context = context ? context : this;
        var self = context;

        markers.forEach(function(val){
            if(!self.Markers[val.group.id]){
                self.Markers[val.group.id] = {
                    id: val.group.id,
                    label: val.group.label,
                    slug: val.group.slug,
                    icon: val.group.icon,
                    items: {}
                };
            }
            if(self.Markers[val.group.id]['items'][val.id]){
                console.log('Warning: Duplicate marker ID');
                return;
            } else {
                self.Markers[val.group.id]['items'][val.id] = new InteractiveMapMarker({
                    id: val.id,
                    group: val.group,
                    label: val.label,
                    position: val.position,
                    desc: val.description ? val.description : null
                });
            }
        });

        if(!context.Elements.Markers){
            var MField = document.createElement('div');
                MField.className = 'iamap-markerslayer';
                MField.style.position = 'absolute';
                MField.style.left = 0; MField.style.top = 0; MField.style.right = 0; MField.style.bottom = 0;
            context.Elements.Markers = MField;
            context.Elements.Map.appendChild(context.Elements.Markers);
        }

        context.Render();
    }
    HideMarkers(filter) {
        let Markers = this.FilterMarkers(filter).items;

        if(Markers){
            for(let key in Markers){
                let MarkerId = Markers[key].id;
                let MarkerGroup = Markers[key].group.id;

                if(this.Markers[MarkerGroup] && this.Markers[MarkerGroup].items[MarkerId]){
                    this.Markers[MarkerGroup].items[MarkerId].render = false;
                }
            }
        } else {
            return false;
        }

        this.Render();
    }
    ShowMarkers(filter){
        let Markers = this.FilterMarkers(filter).items;

        if(Markers){
            for(let key in Markers){
                let MarkerId = Markers[key].id;
                let MarkerGroup = Markers[key].group.id;

                if(this.Markers[MarkerGroup] && this.Markers[MarkerGroup].items[MarkerId]){
                    this.Markers[MarkerGroup].items[MarkerId].render = true;
                }
            }
        } else {
            return false;
        }

        this.Render();
    }
    FilterMarkers(filter){
        if(!filter){
            let filter = {
                type: 'all'
            };
        }

        let Markers;
        
        switch(filter.type){
            case 'group':
                if(!filter.group){
                    Markers = null;
                } else {
                    Markers = this.Markers[filter.group];
                }
                break;
            case 'marker':
                if(!filter.group || !filter.id){
                    Markers = null;
                } else {
                    Markers = this.Markers[filter.group]['items'][filter.id];
                }
                break;
            case 'all':
            default:
                Markers = this.Markers;
                break;
        }

        return Markers == null ? false : Markers;
    }
    AddToSynchQueue(name, context, args){
        let self = this;

        this.SynchQueue.push({
            f: name,
            c: context ? self : null,
            data: Array.isArray(args) ? args : Array(args)
        });
    }
    RunSynchQueue(){
        let self = this;

        this.SynchQueue.forEach(function(e){
            if(e.c) {
                e.data.push(self);
            }
            self[e.f].apply(self, e.data);
        });
    }
    GetGeographicDistance(lon1,lat1,lon2,lat2){
        let R = 6391;
        let dLat = this.Deg2Rad(lat2 - lat1);
        let dLon = this.Deg2Rad(lon2 - lon1);
        let a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.Deg2Rad(lat1)) * Math.cos(this.Deg2Rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c * 1000;
    }
    Deg2Rad(deg){
        return deg * (Math.PI/180);
    }
}
class InteractiveMapMarker {
    constructor(cfg){
        if(!cfg || !cfg.group || !cfg.id || !cfg.position || !cfg.label){
            console.log('Marker error: The definition of config incorrect');
        } else {
            this.id = cfg.id;
            this.group = cfg.group;
            this.position = cfg.position;
            this.label = cfg.label;
            this.desc = cfg.desc ? cfg.desc : "";
            this.render = true;
        }
    }
    cfgError(field){
        return alert('The field ' + field + ' is missing from configuration');
    }
    getPosition(){
        return this.position;
    }
}

var DemoMapConfig = {
    "Map": "http://mapsvg.com/maps/geo-calibrated/denmark.svg",
    "UsesRealWorld": true,
    "Longitude": {
        "Start": 8.07207151,
        "End": 15.15781381
    },
    "Latitude": {
        "Start": 57.75191059,
        "End": 54.55877948
    }
}
var Config = {
    Position: {
        x: 10,
        y: 10
    },
    Zoom: 1
}
var MarkersData = Array(
    {
        group: {
            id: 0,
            slug: 'cities',
            label: 'Cities',
            icon: null
        },
        id: 1226,
        label: 'Copenhagen',
        description: 'Description',
        position: {
            x: 12.5683372,
            y: 55.6760968
        }
    },
    {
        group: {
            id: 0,
            slug: 'cities',
            label: 'Cities',
            icon: null
        },
        id: 4551,
        label: 'Odense',
        description: 'Description',
        position: {
            x: 10.40237,
            y: 55.403756
        }
    }
);

var Map = new InteractiveMap(document.getElementById('map-element'), DemoMapConfig, Config);
    Map.AddMarkers(MarkersData);
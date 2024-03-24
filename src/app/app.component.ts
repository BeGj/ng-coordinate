import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { Feature, Map, View } from 'ol';
import { toStringHDMS } from 'ol/coordinate';
import WKT from 'ol/format/WKT.js';
import {
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'ol/geom';
import Draw from 'ol/interaction/Draw.js';
import { defaults as defaltInteractions } from 'ol/interaction/defaults';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { useGeographic } from 'ol/proj.js';
import { OSM } from 'ol/source';
import VectorSource from 'ol/source/Vector';
import { CoordinateService } from './services/coordinate.service';
useGeographic();
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ReactiveFormsModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  olMapElement = viewChild.required<ElementRef>('olMapContainer');
  coordinateService = inject(CoordinateService);

  wktFormGroup = new FormGroup({
    wkt: new FormControl<string>('', { nonNullable: true }),
  });

  dmsFormGroup = new FormGroup({
    dms: new FormControl<string>('', { nonNullable: true }),
  });

  latLonFormGroup = new FormGroup({
    lat: new FormControl<number | undefined>(undefined, { nonNullable: true }),
    lon: new FormControl<number | undefined>(undefined, { nonNullable: true }),
  });

  mgrsFormGroup = new FormGroup({
    mgrs: new FormControl<string>('', { nonNullable: true }),
  });

  vectorLayer = new VectorLayer({
    source: new VectorSource(),
  });
  drawPointLayer = new VectorLayer({
    source: new VectorSource(),
  });
  drawInteraction = new Draw({
    type: 'Point',
    source: this.drawPointLayer.getSource()!,
  });
  olMap = new Map({
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
      this.vectorLayer,
    ],
    interactions: defaltInteractions().extend([this.drawInteraction]),
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  });

  result$$ = signal<
    | {
        lonLat: [number, number];
        bbox?: [number, number, number, number];
        wkt: string;
        dms: string;
        dmsWithoutSpace: string;
        mgrs: string;
      }
    | undefined
  >(undefined);

  constructor() {
    effect(() => {
      const div = this.olMapElement();
      this.olMap.setTarget(div.nativeElement);
    });

    this.drawInteraction.on('drawend', (event) => {
      const lonLat = (
        event.feature.getGeometry() as Point
      ).getCoordinates() as [number, number];
      this.setResult(lonLat);
    });
  }

  onSubmitDMS(input: string) {
    const result = this.coordinateService.parse(input);
    const { decimalLatitude, decimalLongitude } = result;
    this.olMap.getView().animate({
      center: [Number(decimalLongitude), Number(decimalLatitude)],
      duration: 300,
      zoom: 10,
    });
    const feature = new Feature(
      new Point([Number(decimalLongitude), Number(decimalLatitude)])
    );
    this.vectorLayer.getSource()?.addFeature(feature);
    this.setResult([Number(decimalLongitude), Number(decimalLatitude)]);
  }

  onSubmitLatLon(lat?: number, lon?: number) {
    if (lat && lon) {
      this.olMap.getView().animate({
        center: [lon, lat],
        duration: 300,
        zoom: 10,
      });
      const feature = new Feature(new Point([lon, lat]));
      this.vectorLayer.getSource()?.addFeature(feature);
      this.setResult([lon, lat]);
    }
  }

  onSubmitMGRS(input: string) {
    const { lonLat, bbox } = this.coordinateService.parseMgrs(input);
    if (bbox) {
      //bbox to polygon
      const feature = new Feature(
        new Polygon([
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[1]],
            [bbox[2], bbox[3]],
            [bbox[0], bbox[3]],
            [bbox[0], bbox[1]],
          ],
        ])
      );
      this.vectorLayer.getSource()?.addFeature(feature);
      this.olMap.getView().fit(bbox, {
        duration: 300,
        padding: [100, 100, 100, 100],
      });
    } else {
      const feature = new Feature(new Point(lonLat));
      this.vectorLayer.getSource()?.addFeature(feature);
      this.olMap.getView().animate({
        center: lonLat,
        duration: 300,
        zoom: 10,
      });
    }
    this.setResult(lonLat, bbox);
  }

  onSubmitWKT(input: string) {
    const reader = new WKT();
    const geometry = reader.readGeometry(input);
    const feature = new Feature(geometry);
    this.vectorLayer.getSource()?.addFeature(feature);
    if (geometry.getType() === 'Point') {
      this.olMap.getView().animate({
        center: (geometry as Point).getCoordinates(),
        duration: 300,
        zoom: 10,
      });
    } else {
      this.olMap.getView().fit(geometry.getExtent(), {
        duration: 300,
      });
    }

    if (geometry.getType() === 'Point') {
      this.setResult((geometry as Point).getCoordinates() as [number, number]);
    } else if (geometry.getType() === 'LineString') {
      this.setResult(
        (geometry as LineString).getFirstCoordinate() as [number, number],
        (geometry as LineString).getExtent() as [number, number, number, number]
      );
    } else if (geometry.getType() === 'Polygon') {
      this.setResult(
        (geometry as Polygon).getFirstCoordinate() as [number, number],
        (geometry as Polygon).getExtent() as [number, number, number, number]
      );
    } else if (geometry.getType() === 'MultiPoint') {
      this.setResult(
        (geometry as MultiPoint).getFirstCoordinate() as [number, number],
        (geometry as MultiPoint).getExtent() as [number, number, number, number]
      );
    } else if (geometry.getType() === 'MultiLineString') {
      this.setResult(
        (geometry as MultiLineString).getFirstCoordinate() as [number, number],
        (geometry as MultiLineString).getExtent() as [
          number,
          number,
          number,
          number
        ]
      );
    } else if (geometry.getType() === 'MultiPolygon') {
      this.setResult(
        (geometry as MultiPolygon).getFirstCoordinate() as [number, number],
        (geometry as MultiPolygon).getExtent() as [
          number,
          number,
          number,
          number
        ]
      );
    }
  }

  setResult(lonLat: [number, number], bbox?: [number, number, number, number]) {
    const wkt = new WKT();
    const wktString = wkt.writeGeometry(new Point(lonLat)).trim();
    const dms = toStringHDMS(lonLat);
    this.result$$.set({
      lonLat,
      bbox,
      wkt: wktString,
      dms,
      dmsWithoutSpace: dms
        .replaceAll('°', '')
        .replaceAll('′', '')
        .replaceAll('″', '')
        .replaceAll(' ', ''),
      mgrs: this.coordinateService.pointToMgrs(lonLat),
    });
  }
}

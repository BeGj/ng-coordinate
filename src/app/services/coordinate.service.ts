import { Injectable } from '@angular/core';
import { convert } from 'geo-coordinates-parser';
import { forward, inverse, toPoint } from 'mgrs';

@Injectable({
  providedIn: 'root',
})
export class CoordinateService {
  constructor() {}

  public parse(input: string) {
    return convert(input);
  }

  public parseMgrs(input: string) {
    return {
      bbox: inverse(input),
      lonLat: toPoint(input),
    };
  }

  public pointToMgrs = forward;
}

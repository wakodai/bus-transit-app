export type ItineraryLeg =
  | {
      kind: "vehicle";
      routeName: string;
      fromStopName: string;
      fromStopId: string;
      fromLat?: number;
      fromLon?: number;
      toStopName: string;
      toStopId: string;
      toLat?: number;
      toLon?: number;
      departureTimeHHmm: string;
      arrivalTimeHHmm: string;
    }
  | {
      kind: "transfer";
      fromStopName: string;
      fromStopId: string;
      fromLat?: number;
      fromLon?: number;
      toStopName: string;
      toStopId: string;
      toLat?: number;
      toLon?: number;
      minTransferMinutes: number;
    };

export type Itinerary = {
  legs: ItineraryLeg[];
  usedRouteNames: string[];
};

export type ItineraryLeg =
  | {
      kind: "vehicle";
      routeName: string;
      fromStopName: string;
      toStopName: string;
      departureTimeHHmm: string;
      arrivalTimeHHmm: string;
    }
  | {
      kind: "transfer";
      fromStopName: string;
      toStopName: string;
      minTransferMinutes: number;
    };

export type Itinerary = {
  legs: ItineraryLeg[];
  usedRouteNames: string[];
};

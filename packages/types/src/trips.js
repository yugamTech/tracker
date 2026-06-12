"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderStatus = exports.Direction = exports.TripStatus = void 0;
var TripStatus;
(function (TripStatus) {
    TripStatus["SCHEDULED"] = "SCHEDULED";
    TripStatus["STARTED"] = "STARTED";
    TripStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TripStatus["COMPLETED"] = "COMPLETED";
    TripStatus["CANCELLED"] = "CANCELLED";
    TripStatus["ABORTED"] = "ABORTED";
})(TripStatus || (exports.TripStatus = TripStatus = {}));
var Direction;
(function (Direction) {
    Direction["PICKUP"] = "PICKUP";
    Direction["DROP"] = "DROP";
})(Direction || (exports.Direction = Direction = {}));
var RiderStatus;
(function (RiderStatus) {
    RiderStatus["EXPECTED"] = "EXPECTED";
    RiderStatus["BOARDED"] = "BOARDED";
    RiderStatus["NOT_BOARDED"] = "NOT_BOARDED";
    RiderStatus["CANCELLED"] = "CANCELLED";
})(RiderStatus || (exports.RiderStatus = RiderStatus = {}));
//# sourceMappingURL=trips.js.map
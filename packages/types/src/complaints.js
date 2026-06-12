"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplaintCategory = exports.ComplaintStatus = void 0;
var ComplaintStatus;
(function (ComplaintStatus) {
    ComplaintStatus["RECEIVED"] = "RECEIVED";
    ComplaintStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ComplaintStatus["COUNSELLING_CALL"] = "COUNSELLING_CALL";
    ComplaintStatus["ADMIN_CALL"] = "ADMIN_CALL";
    ComplaintStatus["RESOLVED"] = "RESOLVED";
    ComplaintStatus["PARENT_RATING"] = "PARENT_RATING";
    ComplaintStatus["VISIT"] = "VISIT";
    ComplaintStatus["CLOSED"] = "CLOSED";
    ComplaintStatus["REOPENED"] = "REOPENED";
})(ComplaintStatus || (exports.ComplaintStatus = ComplaintStatus = {}));
var ComplaintCategory;
(function (ComplaintCategory) {
    ComplaintCategory["BEHAVIOUR"] = "BEHAVIOUR";
    ComplaintCategory["SAFETY"] = "SAFETY";
    ComplaintCategory["TIMING"] = "TIMING";
    ComplaintCategory["VEHICLE_CONDITION"] = "VEHICLE_CONDITION";
    ComplaintCategory["ROUTE_ISSUE"] = "ROUTE_ISSUE";
    ComplaintCategory["OTHER"] = "OTHER";
})(ComplaintCategory || (exports.ComplaintCategory = ComplaintCategory = {}));
//# sourceMappingURL=complaints.js.map
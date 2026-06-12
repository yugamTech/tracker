"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipStatus = exports.PersonStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["PARENT"] = "PARENT";
    Role["TEACHER_RIDER"] = "TEACHER_RIDER";
    Role["DRIVER"] = "DRIVER";
    Role["CONDUCTOR"] = "CONDUCTOR";
    Role["ADMIN"] = "ADMIN";
    Role["TRANSPORT_MANAGER"] = "TRANSPORT_MANAGER";
    Role["FOUNDER"] = "FOUNDER";
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
})(Role || (exports.Role = Role = {}));
var PersonStatus;
(function (PersonStatus) {
    PersonStatus["ACTIVE"] = "ACTIVE";
    PersonStatus["INACTIVE"] = "INACTIVE";
    PersonStatus["SUSPENDED"] = "SUSPENDED";
})(PersonStatus || (exports.PersonStatus = PersonStatus = {}));
var MembershipStatus;
(function (MembershipStatus) {
    MembershipStatus["PENDING"] = "PENDING";
    MembershipStatus["ACTIVE"] = "ACTIVE";
    MembershipStatus["SUSPENDED"] = "SUSPENDED";
})(MembershipStatus || (exports.MembershipStatus = MembershipStatus = {}));
//# sourceMappingURL=auth.js.map
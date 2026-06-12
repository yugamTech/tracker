import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PersonsService } from './persons.service';
import { StudentsService } from './students.service';
import { MembersService } from './members.service';
import { VehiclesService } from './vehicles.service';
import { RoutesService } from './routes.service';
import { StopsService } from './stops.service';
import { AgeGroupsService } from './age-groups.service';
import { TenantsService } from './tenants.service';
import { PersonsController } from './controllers/persons.controller';
import { StudentsController } from './controllers/students.controller';
import { MembersController } from './controllers/members.controller';
import { VehiclesController } from './controllers/vehicles.controller';
import { RoutesController } from './controllers/routes.controller';
import { StopsController } from './controllers/stops.controller';
import { AgeGroupsController } from './controllers/age-groups.controller';
import { TenantsController } from './controllers/tenants.controller';

@Module({
  imports: [JwtModule],
  controllers: [
    PersonsController,
    StudentsController,
    MembersController,
    VehiclesController,
    RoutesController,
    StopsController,
    AgeGroupsController,
    TenantsController,
  ],
  providers: [
    PersonsService,
    StudentsService,
    MembersService,
    VehiclesService,
    RoutesService,
    StopsService,
    AgeGroupsService,
    TenantsService,
  ],
  exports: [PersonsService, StudentsService, MembersService, VehiclesService, RoutesService, StopsService, AgeGroupsService, TenantsService],
})
export class IdentityModule {}

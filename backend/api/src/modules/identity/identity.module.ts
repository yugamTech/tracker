import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PersonsService } from './persons.service';
import { StudentsService } from './students.service';
import { StudentsController } from './controllers/students.controller';
import { PersonsController } from './controllers/persons.controller';

@Module({
  imports: [JwtModule],
  controllers: [PersonsController, StudentsController],
  providers: [PersonsService, StudentsService],
  exports: [PersonsService, StudentsService],
})
export class IdentityModule {}

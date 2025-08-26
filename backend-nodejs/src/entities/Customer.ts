import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Visit } from "./Visit";
import { Equipment } from "./Equipment";
import { RouteChoice } from "./RouteChoice";
import { DailyTask } from "./DailyTask";
import { formatEuropeanDate } from "../utils/dateUtils";

@Entity("customers")
export class Customer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, nullable: false })
  name!: string;

  @Column({ type: "varchar", length: 200, nullable: true })
  address?: string;

  @Column({ name: "postal_code", type: "varchar", length: 20, nullable: true })
  postalCode?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  city?: string;

  @Column({ name: "contact_person", type: "varchar", length: 100, nullable: true })
  contactPerson?: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  email?: string;

  @Column({  name: "visits_per_year", type: "int", nullable: true })
  visitsPerYear?: number;

  @Column({ name: "start_date", type: "date", nullable: true })
  startDate?: Date;

  @Column({ type: "float", nullable: true })
  latitude?: number;

  @Column({ type: "float", nullable: true })
  longitude?: number;

  // Relationships
  @OneToMany(() => Visit, visit => visit.customer, { cascade: true })
  visits!: Visit[];

  @OneToMany(() => Equipment, equipment => equipment.customer, { cascade: true })
  equipment!: Equipment[];

  @OneToMany(() => RouteChoice, routeChoice => routeChoice.customer, { cascade: true })
  routeChoices!: RouteChoice[];

  @OneToMany(() => DailyTask, dailyTask => dailyTask.customer, { cascade: true })
  dailyTasks!: DailyTask[];

  toDict() {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      postal_code: this.postalCode,
      city: this.city,
      contact_person: this.contactPerson,
      phone: this.phone,
      email: this.email,
      visits_per_year: this.visitsPerYear,
  start_date: formatEuropeanDate(this.startDate),
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}

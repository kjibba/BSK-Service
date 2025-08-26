import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from "typeorm";
import { Customer } from "./Customer";
import { ServiceLog } from "./ServiceLog";
import { formatEuropeanDate, formatEuropeanDateTime } from "../utils/dateUtils";
import { Photo } from "./Photo";

@Entity("visits")
export class Visit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "customer_id", type: "int", nullable: false })
  @Index()
  customerId!: number;

  @Column({ name: "visit_date", type: "datetime", nullable: false })
  visitDate!: Date;

  @Column({ type: "varchar", length: 100, nullable: true })
  technician?: string;

  @Column({ type: "text", nullable: true })
  notes?: string;

  // Workflow fields
  @Column({ type: "varchar", length: 20, nullable: true, default: "Planlagt" })
  @Index()
  status?: string;

  @Column({  name: "assigned_technician_id", type: "int", nullable: true })
  @Index()
  assignedTechnicianId?: number;

  @Column({  name: "owner_technician_id", type: "int", nullable: true })
  @Index()
  ownerTechnicianId?: number;

  @Column({ name: "started_at", type: "datetime", nullable: true })
  startedAt?: Date;

  @Column({ name: "completed_at", type: "datetime", nullable: true })
  completedAt?: Date;

  // Checklist + summary
  @Column({ name: "oppsummering_notat", type: "text", nullable: true })
  oppsummeringNotat?: string;

  @Column({ name: "sjekk_advarselskilt", type: "boolean", default: false })
  sjekkAdvarselskilt?: boolean;

  @Column({ name: "sjekk_agnstasjoner", type: "boolean", default: false })
  sjekkAgnstasjoner?: boolean;

  @Column({ name: "sjekk_inngangspunkter", type: "boolean", default: false })
  sjekkInngangspunkter?: boolean;

  @Column({ name: "sjekk_fellefangst", type: "boolean", default: false })
  sjekkFellefangst?: boolean;

  // Relationships
  @ManyToOne(() => Customer, customer => customer.visits)
  @JoinColumn({ name: "customer_id" })
  customer!: Customer;

  @OneToMany(() => ServiceLog, serviceLog => serviceLog.visit, { cascade: true })
  serviceLogs!: ServiceLog[];

  @OneToMany(() => Photo, photo => photo.visit, { cascade: true })
  photos!: Photo[];

  toDict() {
    return {
      id: this.id,
      customer_id: this.customerId,
  visit_date: formatEuropeanDate(this.visitDate),
      technician: this.technician,
      notes: this.notes,
      status: this.status,
      assigned_technician_id: this.assignedTechnicianId,
      owner_technician_id: this.ownerTechnicianId,
  started_at: formatEuropeanDateTime(this.startedAt),
  completed_at: formatEuropeanDateTime(this.completedAt),
      oppsummering_notat: this.oppsummeringNotat,
      sjekk_advarselskilt: this.sjekkAdvarselskilt,
      sjekk_agnstasjoner: this.sjekkAgnstasjoner,
      sjekk_inngangspunkter: this.sjekkInngangspunkter,
      sjekk_fellefangst: this.sjekkFellefangst,
    };
  }
}

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Customer } from "./Customer";
import { formatEuropeanDate } from "../utils/dateUtils";

@Entity("route_choices")
export class RouteChoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "technician_email", type: "varchar", length: 100, nullable: true })
  technicianEmail?: string;

  @Column({  name: "customer_id", type: "int", nullable: true })
  @Index()
  customerId?: number;

  @Column({ name: "selected_date", type: "date", nullable: true })
  selectedDate?: Date;

  @ManyToOne(() => Customer, customer => customer.routeChoices)
  @JoinColumn({ name: "customer_id" })
  customer?: Customer;

  toDict() {
    return {
      id: this.id,
      technician_email: this.technicianEmail,
      customer_id: this.customerId,
      selected_date: formatEuropeanDate(this.selectedDate),
    };
  }
}

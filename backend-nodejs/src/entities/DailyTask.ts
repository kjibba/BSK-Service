import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Customer } from "./Customer";
import { formatEuropeanDate } from "../utils/dateUtils";

@Entity("daily_tasks")
export class DailyTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "customer_id", type: "int", nullable: false })
  @Index()
  customerId!: number;

  @Column({ name: "task_date", type: "date", nullable: false })
  @Index()
  taskDate!: Date;

  @Column({ name: "technician_email", type: "varchar", length: 100, nullable: true })
  technicianEmail?: string;

  @ManyToOne(() => Customer, customer => customer.dailyTasks)
  @JoinColumn({ name: "customer_id" })
  customer!: Customer;

  toDict() {
    return {
      id: this.id,
      customer_id: this.customerId,
      task_date: formatEuropeanDate(this.taskDate),
      technician_email: this.technicianEmail,
    };
  }
}

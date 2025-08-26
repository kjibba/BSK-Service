import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { Employee } from "./Employee";
import { formatEuropeanDateTime } from "../utils/dateUtils";

@Entity("feedback")
export class Feedback {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({  name: "user_id", type: "int", nullable: true })
  @Index()
  userId?: number;

  @Column({ name: "user_email", type: "varchar", length: 200, nullable: true })
  userEmail?: string;

  @Column({ type: "text", nullable: true })
  text?: string;

  @Column({ type: "json", nullable: true })
  context?: any;

  @Column({ type: "json", nullable: true })
  diagnostics?: any;

  @Column({ type: "varchar", length: 30, default: "open", nullable: true })
  @Index()
  status?: string;

  @Column({ name: "handler_note", type: "text", nullable: true })
  handlerNote?: string;

  @Column({  name: "handled_by", type: "int", nullable: true })
  handledBy?: number;

  @Column({ name: "created_at", type: "datetime", nullable: true })
  createdAt?: Date;

  @Column({ name: "updated_at", type: "datetime", nullable: true })
  updatedAt?: Date;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "user_id" })
  user?: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: "handled_by" })
  handler?: Employee;

  toDict() {
    return {
      id: this.id,
      user_id: this.userId,
      user_email: this.userEmail,
      text: this.text,
      context: this.context,
      diagnostics: this.diagnostics,
      status: this.status,
      handler_note: this.handlerNote,
      handled_by: this.handledBy,
      created_at: formatEuropeanDateTime(this.createdAt),
      updated_at: formatEuropeanDateTime(this.updatedAt),
    };
  }
}

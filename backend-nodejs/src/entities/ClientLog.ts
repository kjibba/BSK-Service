import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity({ name: "client_logs" })
export class ClientLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ type: "varchar", length: 20, default: "error" })
  @Index()
  level!: string; // error | warn | info

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "mediumtext", nullable: true })
  stack?: string | null;

  @Column({ type: "varchar", length: 1024, nullable: true })
  url?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  route?: string | null;

  @Column({ name: "user_agent", type: "varchar", length: 512, nullable: true })
  userAgent?: string | null;

  @Column({ name: "user_id", type: "int", nullable: true })
  @Index()
  userId?: number | null;

  @Column({ name: "meta_json", type: "mediumtext", nullable: true })
  metaJson?: string | null;
}

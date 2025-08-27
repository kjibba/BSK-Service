import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("service_reports")
export class ServiceReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: "visit_id", type: "int" })
  visitId!: number;

  @Index()
  @Column({ name: "customer_id", type: "int" })
  customerId!: number;

  @Column({ name: "file_path", type: "varchar", length: 500 })
  filePath!: string; // relative path under /static

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  toDict(){
    return {
      id: this.id,
      visit_id: this.visitId,
      customer_id: this.customerId,
      file_path: this.filePath,
      created_at: this.createdAt?.toISOString?.(),
      url: this.filePath.startsWith('/static') ? this.filePath : (`/static/${this.filePath.replace(/^\\+/,'')}`),
    }
  }
}

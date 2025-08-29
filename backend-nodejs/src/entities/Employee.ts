import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("employees")
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, nullable: false })
  name!: string;

  @Column({ type: "varchar", length: 100, unique: true, nullable: true })
  email?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  role?: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  title?: string;

  @Column({ type: "boolean", default: true })
  active?: boolean;

  // Store bcrypt hash; never expose in API
  @Column({ type: "varchar", length: 255, name: "password_hash", nullable: true })
  passwordHash?: string | null;

  toDict() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      phone: this.phone,
      title: this.title,
      active: this.active,
    };
  }
}

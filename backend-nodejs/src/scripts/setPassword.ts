import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import bcrypt from "bcryptjs";

async function main(){
  const email = (process.env.USER_EMAIL || process.env.ADMIN_EMAIL || "").toLowerCase();
  const password = process.env.USER_PASSWORD || process.env.ADMIN_PASSWORD || "";
  if (!email || !password){
    console.error("USER_EMAIL and USER_PASSWORD envs are required");
    process.exit(1);
  }
  await AppDataSource.initialize();
  try{
    const repo = AppDataSource.getRepository(Employee);
    const user = await repo.findOne({ where: { email } });
    if (!user){
      console.error("User not found:", email);
      process.exit(2);
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    await repo.save(user);
    console.log(`Password updated for ${email}`);
    process.exit(0);
  } catch(e){
    console.error("setPassword failed:", e);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

main();

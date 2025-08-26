import { AppDataSource } from './data-source'

async function main(){
  try{
    await AppDataSource.initialize()
    const hasPending = await AppDataSource.showMigrations()
    console.log('Pending migrations:', hasPending)
    const res = await AppDataSource.runMigrations()
    if (res && res.length) {
      console.log('Executed migrations:')
      for (const m of res) console.log('-', m.name)
    } else {
      console.log('No migrations executed (none pending).')
    }
    await AppDataSource.destroy()
    process.exit(0)
  } catch (e){
    console.error('Migration run failed:', e)
    process.exit(1)
  }
}

main()

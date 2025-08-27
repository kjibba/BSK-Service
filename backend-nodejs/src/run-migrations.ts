import { AppDataSource } from './data-source'
import { DataSource } from 'typeorm'
import path from 'path'

async function main(){
  try{
    // In production, ensure we use compiled JS migrations from dist, regardless of default config
    const isProd = (process.env.NODE_ENV || 'development') === 'production'
    const ds = isProd
      ? new DataSource({
          ...(AppDataSource.options as any),
          migrations: [path.join(__dirname, 'migrations', '*.js')],
        })
      : AppDataSource

    await ds.initialize()
    const hasPending = await ds.showMigrations()
    console.log('Pending migrations:', hasPending)
    const res = await ds.runMigrations()
    if (res && res.length) {
      console.log('Executed migrations:')
      for (const m of res) console.log('-', m.name)
    } else {
      console.log('No migrations executed (none pending).')
    }
    await ds.destroy()
    process.exit(0)
  } catch (e){
    console.error('Migration run failed:', e)
    process.exit(1)
  }
}

main()

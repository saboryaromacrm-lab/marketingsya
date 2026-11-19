import { ProbarMotor } from '../ProbarMotor'

export const metadata = { title: 'Motor de piezas' }

export default function Motor() {
  return (
    <section className="tarjeta">
      <h2 className="titulo-seccion">Motor de piezas</h2>
      <ProbarMotor />
    </section>
  )
}

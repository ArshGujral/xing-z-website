import { createXingZHighSpeedCoolerMotorModel } from './generated/high-speed'
import { buildMotor, type MotorParams } from './motor'
import projector from './projectors/high-speed.json'

// Mounting ring = the raised strap and its two overlap seams; the band it covers on the can.
export const createModel = (params: MotorParams = {}) =>
  buildMotor(
    {
      create: createXingZHighSpeedCoolerMotorModel,
      projector,
      ringParts: ['clamp-band', 'band-seam-left', 'band-seam-right'],
      ringSpan: [0.29, 0.755],
      plainCoat: [0.12, 0.28],
    },
    params,
  )

import { createXingZ110CoolerMotorModel } from './generated/110'
import { buildMotor, type MotorParams } from './motor'
import projector from './projectors/110.json'

const LUGS = ['front-left', 'front-right', 'back-right', 'back-left'] // brackets where the product photo has them

// Mounting ring = the cast ring, its four brackets with their brass bolts, and the front notch.
export const createModel = (params: MotorParams = {}) =>
  buildMotor(
    {
      create: createXingZ110CoolerMotorModel,
      projector,
      ringParts: ['mounting-ring', 'ring-notch', ...LUGS.flatMap((l) => [`lug-${l}`, `lug-bolt-${l}-0`, `lug-bolt-${l}-1`])],
      ringSpan: [0.29, 0.57],
      plainCoat: [0.1, 0.28],
    },
    params,
  )

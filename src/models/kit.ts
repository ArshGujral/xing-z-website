import { createXingZKitCoolerMotorModel } from './generated/kit'
import { buildMotor, type MotorParams } from './motor'
import projector from './projectors/kit.json'

const LUGS = ['front-left', 'front-right', 'back-right', 'back-left'] // brackets where the product photo has them

// Mounting ring = the cast ring, its four brackets with their brass bolts, and the front notch.
export const createModel = (params: MotorParams = {}) =>
  buildMotor(
    {
      create: createXingZKitCoolerMotorModel,
      projector,
      ringParts: ['mounting-ring', 'ring-notch', ...LUGS.flatMap((l) => [`lug-${l}`, `lug-bolt-${l}-0`, `lug-bolt-${l}-1`])],
      ringSpan: [0.22, 0.42],
      plainCoat: [0.06, 0.2],
    },
    params,
  )

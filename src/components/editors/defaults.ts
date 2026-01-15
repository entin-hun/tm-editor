import {
  FoodInstance,
  GenericProcess,
  KnowHow,
  LocalInputInstance,
  MachineInstance,
  MillingProcess,
  Price,
  PrintingProcess,
  TemperatureRange,
  TransportedInputInstance,
  Transport,
  GenericInputInstance,
  CartridgeInstance,
  ID,
  Location,
  Hr,
  FreezeDryingProcess,
  Pokedex,
  SaleProcess,
  BlendingProcess,
  HarvestProcess,
  GenericImpact,
  CarbonImpact,
  WaterImpact,
  FallbackFoodNutrient,
  Site,
  Priced,
  ProductInstance,
} from '@trace.market/types';

export const defaultHr: Hr = {
  tasks: '',
  assignee: '',
};

export const defaultMachineInstance: MachineInstance = {
  category: '',
  ownerId: '',
  quantity: 0,
  size: '',
  hr: defaultHr,
  providerSDomain: '',
};

export const defaultPrice: Price = {
  amount: 0,
  currency: '',
  type: 'budget',
};

export const defaultKnowHow: KnowHow = {
  owner: '',
  hash: '',
  inputs: '',
  outputs: '',
  licenseFee: defaultPrice,
};

export const defaultLocation: Location = {
  type: 'Point',
  coordinates: [0, 0],
};

export const defaultTemperatureRange: TemperatureRange = {
  min: 0,
  max: 100,
};

export const defaultSite: Site = {
  label: undefined,
  location: defaultLocation,
};

export const defaultGenericProcess: GenericProcess = {
  timestamp: new Date().getTime(),
  site: defaultSite,
  temperatureRange: defaultTemperatureRange,
  inputInstances: [],
  price: undefined,
};

export const defaultMillingProcess: MillingProcess = {
  ...defaultGenericProcess,
  ...{
    type: 'milling',
    knowHow: defaultKnowHow,
    machineInstance: defaultMachineInstance,
  },
};

export const defaultPrintingProcess: PrintingProcess = {
  ...defaultGenericProcess,
  ...{
    type: 'printing',
    machineInstance: defaultMachineInstance,
    knowHow: defaultKnowHow,
    shape: '',
  },
};

export const defaultFreezeDryingProcess: FreezeDryingProcess = {
  ...defaultGenericProcess,
  ...{
    type: 'freezedrying',
    machineInstance: defaultMachineInstance,
    knowHow: defaultKnowHow,
  },
};

export const defaultBlendingProcess: BlendingProcess = {
  ...defaultGenericProcess,
  ...{
    type: 'blending',
    machineInstance: defaultMachineInstance,
    knowHow: defaultKnowHow,
  },
};

export const defaultHarvestProcess: HarvestProcess = {
  ...defaultGenericProcess,
  ...{
    type: 'harvest',
    machineInstance: defaultMachineInstance,
  },
};

export const defaultFoodInstance: FoodInstance = {
  category: 'food',
  type: '',
  bio: false,
  quantity: 1,
};

export const defaultGenericInputInstance: GenericInputInstance = {
  priceShare: 1,
  instance: '0x0',
  quantity: 1,
};

export const defaultLocalInputInstance: LocalInputInstance = {
  ...defaultGenericInputInstance,
  type: 'local',
};

export const defaultTransport: Transport = {
  deparetureTime: Date.now(),
  duration: 0,
  fuelType: 'diesel',
  weight: 1,
  method: 'sea',
};

export const defaultTransportedInputInstance: TransportedInputInstance = {
  ...defaultGenericInputInstance,
  type: 'transported',
  transport: defaultTransport,
};

export const defaultProductInstance = defaultFoodInstance;

export const defaultPricedProductInstance: Priced<ProductInstance> = {
  ...defaultProductInstance,
  ...{ price: defaultPrice },
};
export const defaultCartridgeInstance: CartridgeInstance = {
  bio: false,
  category: 'cartridge',
  type: '',
  ownerId: '',
  grade: '',
  quantity: 1,
  size: '',
};

export const defaultId: ID = {
  id: '',
  registry: '',
};

export const defaultSaleProcess: SaleProcess = {
  ...defaultGenericProcess,
  ...{
    type: 'sale',
    price: defaultPrice,
  },
};

export const defaultPokedex: Pokedex = {
  contract: '',
  description: '',
  feedchainVersion: '',
  token: '',

  instance: defaultPricedProductInstance,

  // instance: {
  //   category: 'food',
  //   type: 'cocoa',
  //   bio: true,
  //   quantity: 1000,
  //   ownerId: 'aura-labs.cc',
  //   size: 'large',
  //   format: 'ground',
  //   expiryDate: 1754697600000,
  //   process: {
  //     timestamp: 1723154400000,
  //     facility: {
  //       location: {
  //         type: 'Point',
  //         coordinates: [0, 0],
  //       },
  //       label: 'The Grinder',
  //     },
  //     temperatureRange: {
  //       min: 0,
  //       max: 100,
  //     },
  //     inputInstances: [],
  //     type: 'milling',
  //     knowHow: {
  //       owner: '',
  //       hash: '',
  //       inputs: '',
  //       outputs: '',
  //       licenseFee: {
  //         amount: 0,
  //         currency: '',
  //         type: 'budget',
  //       },
  //     },
  //     machineInstance: {
  //       category: '',
  //       ownerId: '',
  //       quantity: 0,
  //       size: '',
  //       hr: {
  //         tasks: '',
  //         assignee: '',
  //       },
  //       providerSDomain: '',
  //     },
  //     duration: 300,
  //     impacts: [
  //       {
  //         ownerId: '',
  //         format: '',
  //         quantity: 5,
  //         category: 'carbon',
  //       },
  //     ],
  //   },
  //   price: {
  //     amount: 8,
  //     currency: '0x18c8a7ec7897177E4529065a7E7B0878358B3BfF',
  //     type: 'budget',
  //   },
  // },
};

const defaultGenericImpact: GenericImpact = {
  ownerId: '',
  format: '',
  quantity: 0,
};

export const defaultCarbonImpact: CarbonImpact = {
  ...defaultGenericImpact,
  ...{
    category: 'carbon',
  },
};

export const defaultWaterImpact: WaterImpact = {
  ...defaultGenericImpact,
  ...{
    category: 'water',
  },
};

export const defaultFallbackFoodNutrient: FallbackFoodNutrient = {
  amount: 0,
  iD: defaultId,
};

export function clone<T>(instance: T): T {
  return JSON.parse(JSON.stringify(instance));
}

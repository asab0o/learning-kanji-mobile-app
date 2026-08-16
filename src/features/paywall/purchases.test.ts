import Purchases from 'react-native-purchases';

import type {
  configurePurchases as ConfigurePurchases,
  fetchOfferings as FetchOfferings,
} from './purchases';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

function loadModule(): {
  configurePurchases: typeof ConfigurePurchases;
  fetchOfferings: typeof FetchOfferings;
} {
  let mod!: {
    configurePurchases: typeof ConfigurePurchases;
    fetchOfferings: typeof FetchOfferings;
  };
  jest.isolateModules(() => {
    mod = require('./purchases');
  });
  return mod;
}

describe('configurePurchases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures the SDK with the Test Store API key', () => {
    const { configurePurchases } = loadModule();

    configurePurchases();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect(Purchases.configure).toHaveBeenCalledWith({
      apiKey: 'test_kJIHcBOQPJHMqpkGFdcSAVRaTDd',
    });
  });

  it('only configures the SDK once even if called multiple times', () => {
    const { configurePurchases } = loadModule();

    configurePurchases();
    configurePurchases();
    configurePurchases();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
  });
});

describe('fetchOfferings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns whatever Purchases.getOfferings resolves to', async () => {
    const { fetchOfferings } = loadModule();
    const offerings = { current: null, all: {} };
    (Purchases.getOfferings as jest.Mock).mockResolvedValue(offerings);

    await expect(fetchOfferings()).resolves.toBe(offerings);
    expect(Purchases.getOfferings).toHaveBeenCalledTimes(1);
  });
});

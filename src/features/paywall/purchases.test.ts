import Purchases from 'react-native-purchases';

import type {
  addCustomerInfoListener as AddCustomerInfoListener,
  configurePurchases as ConfigurePurchases,
  fetchOfferings as FetchOfferings,
  getCustomerInfo as GetCustomerInfo,
  isUserCancelled as IsUserCancelled,
  purchaseMonthly as PurchaseMonthly,
  removeCustomerInfoListener as RemoveCustomerInfoListener,
  restorePurchases as RestorePurchases,
} from './purchases';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
    getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

interface PurchasesModule {
  configurePurchases: typeof ConfigurePurchases;
  fetchOfferings: typeof FetchOfferings;
  getCustomerInfo: typeof GetCustomerInfo;
  purchaseMonthly: typeof PurchaseMonthly;
  restorePurchases: typeof RestorePurchases;
  addCustomerInfoListener: typeof AddCustomerInfoListener;
  removeCustomerInfoListener: typeof RemoveCustomerInfoListener;
  isUserCancelled: typeof IsUserCancelled;
}

function loadModule(): PurchasesModule {
  let mod!: PurchasesModule;
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

describe('customer info and purchase delegation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns whatever Purchases.getCustomerInfo resolves to', async () => {
    const { getCustomerInfo } = loadModule();
    const info = { entitlements: { active: {}, all: {} } };
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue(info);

    await expect(getCustomerInfo()).resolves.toBe(info);
    expect(Purchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });

  it('returns whatever Purchases.restorePurchases resolves to', async () => {
    const { restorePurchases } = loadModule();
    const info = { entitlements: { active: { premium: {} }, all: {} } };
    (Purchases.restorePurchases as jest.Mock).mockResolvedValue(info);

    await expect(restorePurchases()).resolves.toBe(info);
    expect(Purchases.restorePurchases).toHaveBeenCalledTimes(1);
  });

  it('passes the package straight through to Purchases.purchasePackage', async () => {
    const { purchaseMonthly } = loadModule();
    const pkg = { identifier: '$rc_monthly' } as never;
    const result = { customerInfo: { entitlements: { active: {} } } };
    (Purchases.purchasePackage as jest.Mock).mockResolvedValue(result);

    await expect(purchaseMonthly(pkg)).resolves.toBe(result);
    expect(Purchases.purchasePackage).toHaveBeenCalledWith(pkg);
  });

  it('adds and removes the customer info listener', () => {
    const { addCustomerInfoListener, removeCustomerInfoListener } = loadModule();
    const listener = jest.fn();

    addCustomerInfoListener(listener);
    expect(Purchases.addCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);

    removeCustomerInfoListener(listener);
    expect(Purchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
  });
});

describe('isUserCancelled', () => {
  it('is true only when the SDK flags the error as cancelled', () => {
    const { isUserCancelled } = loadModule();

    expect(isUserCancelled({ userCancelled: true })).toBe(true);
    expect(isUserCancelled({ userCancelled: false })).toBe(false);
    // 文字列の 'true' を真と読まない(SDK が形を変えたときに誤検出しないため)
    expect(isUserCancelled({ userCancelled: 'true' })).toBe(false);
    expect(isUserCancelled(new Error('network'))).toBe(false);
    expect(isUserCancelled(null)).toBe(false);
    expect(isUserCancelled(undefined)).toBe(false);
    expect(isUserCancelled('cancelled')).toBe(false);
  });
});

/**
 * コールドスタートで `learningkanjimobileapp://paywall` を開く経路の回帰テスト。
 * 課金画面は EntitlementProvider の子なので effect が先に走る。SDK は未初期化だと
 * reject するので、ラッパ側が自分で configure しないと画面が「unavailable」で固まる。
 */
describe('configure before every SDK call', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['fetchOfferings', 'getOfferings'],
    ['getCustomerInfo', 'getCustomerInfo'],
    ['restorePurchases', 'restorePurchases'],
  ] as const)('%s configures the SDK first', (wrapper, sdkMethod) => {
    const mod = loadModule();
    (Purchases[sdkMethod] as jest.Mock).mockResolvedValue({});

    void mod[wrapper]();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    // 呼び出し順まで見る。configure が後だと SDK は既に reject している
    expect((Purchases.configure as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (Purchases[sdkMethod] as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('purchaseMonthly configures the SDK first', () => {
    const { purchaseMonthly } = loadModule();
    (Purchases.purchasePackage as jest.Mock).mockResolvedValue({});

    void purchaseMonthly({ identifier: '$rc_monthly' } as never);

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
    expect((Purchases.configure as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (Purchases.purchasePackage as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('still configures only once across many calls', async () => {
    const { fetchOfferings, getCustomerInfo, configurePurchases } = loadModule();
    (Purchases.getOfferings as jest.Mock).mockResolvedValue({});
    (Purchases.getCustomerInfo as jest.Mock).mockResolvedValue({});

    configurePurchases();
    await fetchOfferings();
    await getCustomerInfo();

    expect(Purchases.configure).toHaveBeenCalledTimes(1);
  });
});

export const PLANS = {
  basic: {
    id: "basic",
    name: "Basic",
    priceMonthly: 599, // cents
    priceYearly: 12000,
    limits: {
      items: 5,
      users: 1,
      locations: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 2900,
    priceYearly: 29000,
    limits: {
      items: 10,
      users: 2,
      locations: 2,
    },
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceMonthly: 5900,
    priceYearly: 59000,
    limits: {
      items: Infinity,
      users: Infinity,
      locations: Infinity,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    custom: true,
  },
} as const;

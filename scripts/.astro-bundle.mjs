var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/consts.ts
var consts_exports = {};
__export(consts_exports, {
  ADS: () => ADS,
  ANALYTICS: () => ANALYTICS,
  ASSISTANT: () => ASSISTANT,
  CONTACT: () => CONTACT,
  EDITORIAL: () => EDITORIAL,
  FOOTER_COMPANY: () => FOOTER_COMPANY,
  FOOTER_LEGAL: () => FOOTER_LEGAL,
  MEAL_PLAN: () => MEAL_PLAN,
  NAV_LINKS: () => NAV_LINKS,
  NEWSLETTER: () => NEWSLETTER,
  SITE: () => SITE,
  SOCIAL_FOLLOW: () => SOCIAL_FOLLOW,
  SOCIAL_NETWORKS: () => SOCIAL_NETWORKS
});
var SITE = {
  name: "HealthyLifeStyles",
  tagline: "Trusted Wellness",
  /** Used in <title> suffix and OG site name. */
  shortName: "HealthyLifeStyles",
  description: "Free, instant, and accurate health calculators built on peer-reviewed scientific formulas. No signup, no data stored \u2014 just trustworthy wellness insights.",
  /** Default social share image (lives in /public). */
  ogImage: "/og-default.png",
  twitter: "@healthylifestyles",
  locale: "en_US",
  themeColor: "#16a34a"
};
var ANALYTICS = {
  /** GA4 Measurement ID */
  ga4Id: "G-JCHJMQRZZZ",
  /** Google Search Console HTML tag verification token */
  searchConsoleVerification: "iRrHUR8SUPd0LyPdHYbF8iLYfwrzYs4F3nLw7p-yo1c",
  /** Bing Webmaster Tools verification token */
  bingVerification: ""
};
var NEWSLETTER = {
  endpoint: "",
  emailField: "email"
};
var CONTACT = {
  endpoint: "",
  email: "hello@healthylifesstyles.com"
};
var EDITORIAL = {
  reviewerName: "HealthyLifeStyles Medical Review Team",
  reviewerCredential: "Licensed clinicians & registered dietitians",
  lastReviewed: "2026-06-01"
};
var ADS = {
  client: "",
  slots: { afterResult: "", midContent: "", sidebar: "" }
};
var ASSISTANT = {
  endpoint: ""
};
var MEAL_PLAN = {
  endpoint: ""
};
var NAV_LINKS = [
  { label: "Calculators & Tools", href: "/tools" },
  { label: "Wellness Hub", href: "/wellness-hub" },
  { label: "Health Score", href: "/health-score" },
  { label: "AI Assistant", href: "/ai-assistant" },
  { label: "About", href: "/about" }
];
var FOOTER_LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Medical Disclaimer", href: "/medical-disclaimer" },
  { label: "Cookie Policy", href: "/cookie-policy" }
];
var FOOTER_COMPANY = [
  { label: "About Us", href: "/about" },
  { label: "Editorial Policy", href: "/editorial-policy" },
  { label: "Methodology", href: "/methodology" },
  { label: "Accessibility", href: "/accessibility" },
  { label: "Contact", href: "/contact" },
  { label: "All Tools", href: "/tools" },
  { label: "Wellness Hub", href: "/wellness-hub" }
];
var SOCIAL_NETWORKS = {
  x: { label: "X", color: "#000000" },
  facebook: { label: "Facebook", color: "#1877F2" },
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  pinterest: { label: "Pinterest", color: "#BD081C" },
  reddit: { label: "Reddit", color: "#FF4500" }
};
var SOCIAL_FOLLOW = [
  { network: "facebook", href: "https://www.facebook.com/healthylifestyles" },
  { network: "x", href: "https://x.com/healthylifestyles" },
  { network: "pinterest", href: "https://www.pinterest.com/healthylifestyles" },
  { network: "linkedin", href: "https://www.linkedin.com/company/healthylifestyles" }
];

// src/data/authors.ts
var authors_exports = {};
__export(authors_exports, {
  AUTHORS: () => AUTHORS,
  DEFAULT_AUTHOR_SLUG: () => DEFAULT_AUTHOR_SLUG,
  REVIEWER_SLUG: () => REVIEWER_SLUG,
  getAuthor: () => getAuthor,
  getReviewer: () => getReviewer,
  resolveAuthor: () => resolveAuthor
});
var SITE_LINKS = SOCIAL_FOLLOW.map((s) => ({ network: s.network, href: s.href }));
var AUTHORS = [
  {
    slug: "editorial-team",
    name: "HealthyLifeStyles Editorial Team",
    role: "Research & Writing",
    bio: "Our editorial team researches and writes every calculator explainer and Wellness Hub guide. We ground each one in peer-reviewed studies and primary sources (CDC, WHO, ACOG, AHA, and the published literature), link those sources openly, and revisit articles as the evidence changes.",
    initials: "HE",
    color: "#16a34a",
    schemaType: "Organization",
    links: SITE_LINKS
  },
  {
    slug: "medical-review",
    name: "HealthyLifeStyles Medical Review Board",
    role: "Medical & Accuracy Review",
    credential: "Licensed clinicians & registered dietitians",
    bio: "Our medical review board checks health-related tools and articles for clinical accuracy, safe framing, and appropriate disclaimers before they publish. Reviewers are qualified healthcare professionals; we are in the process of adding their individual names and credentials to this page.",
    initials: "MR",
    color: "#0ea5e9",
    schemaType: "Organization",
    links: SITE_LINKS
  }
];
var DEFAULT_AUTHOR_SLUG = "editorial-team";
var REVIEWER_SLUG = "medical-review";
var getAuthor = (slug) => AUTHORS.find((a) => a.slug === slug);
var resolveAuthor = (nameOrSlug) => {
  const bySlug = getAuthor(nameOrSlug);
  if (bySlug) return bySlug;
  const byName = AUTHORS.find((a) => a.name === nameOrSlug);
  return byName ?? getAuthor(DEFAULT_AUTHOR_SLUG);
};
var getReviewer = () => getAuthor(REVIEWER_SLUG);

// src/data/categories.ts
var categories_exports = {};
__export(categories_exports, {
  CATEGORIES: () => CATEGORIES,
  getCategory: () => getCategory
});
var CATEGORIES = [
  {
    id: "nutrition",
    name: "Nutrition",
    slug: "nutrition",
    blurb: "Calories, macros, and daily intake targets.",
    icon: "leaf",
    accent: "var(--c-nutrition)",
    color: "#f97316"
  },
  {
    id: "body-weight",
    name: "Body & Weight",
    slug: "body-weight",
    blurb: "BMI, body fat, and healthy weight ranges.",
    icon: "scale",
    accent: "var(--c-body)",
    color: "#3b82f6"
  },
  {
    id: "fitness",
    name: "Fitness",
    slug: "fitness",
    blurb: "Training pace, strength, and performance.",
    icon: "dumbbell",
    accent: "var(--c-fitness)",
    color: "#8b5cf6"
  },
  {
    id: "heart-vitals",
    name: "Heart Health",
    slug: "heart-health",
    blurb: "Heart rate zones, max HR, and blood pressure.",
    icon: "heart-pulse",
    accent: "var(--c-heart)",
    color: "#ef4444"
  },
  {
    id: "metabolic",
    name: "Metabolic Health",
    slug: "metabolic",
    blurb: "Hydration, metabolism, and energy use.",
    icon: "droplet",
    accent: "var(--c-metabolic)",
    color: "#14b8a6"
  },
  {
    id: "sleep",
    name: "Sleep & Recovery",
    slug: "sleep",
    blurb: "Sleep cycles, naps, and sleep debt.",
    icon: "moon",
    accent: "var(--c-sleep)",
    color: "#6366f1"
  },
  {
    id: "womens-health",
    name: "Women's Health",
    slug: "womens-health",
    blurb: "Cycle, ovulation, and pregnancy tools.",
    icon: "sparkle",
    accent: "var(--c-women)",
    color: "#ec4899"
  },
  {
    id: "health-risk",
    name: "Health Risk",
    slug: "health-risk",
    blurb: "Educational risk estimates \u2014 not a diagnosis.",
    icon: "gauge",
    accent: "var(--c-risk)",
    color: "#d97706"
  },
  {
    id: "mental-wellness",
    name: "Mental Wellness",
    slug: "mental-wellness",
    blurb: "Self-reflection check-ins and calming tools.",
    icon: "smile",
    accent: "var(--c-mind)",
    color: "#0ea5e9"
  }
];
var getCategory = (id) => CATEGORIES.find((c) => c.id === id || c.slug === id);

// src/data/tools.ts
var tools_exports = {};
__export(tools_exports, {
  TOOLS: () => TOOLS,
  TOTAL_TOOLS: () => TOTAL_TOOLS,
  countByCategory: () => countByCategory,
  getLiveTools: () => getLiveTools,
  getPopularTools: () => getPopularTools,
  getRelatedTools: () => getRelatedTools,
  getTool: () => getTool,
  getToolsByCategory: () => getToolsByCategory,
  isToolLive: () => isToolLive
});
var TOOLS = [
  // ---- Nutrition ----
  {
    slug: "intermittent-fasting-calculator",
    title: "Intermittent Fasting Calculator & Timer",
    blurb: "Pick a protocol (16:8, 18:6, OMAD, 5:2), set your eating window, and run a live fasting timer.",
    category: "nutrition",
    icon: "hourglass",
    gradient: "indigo",
    keywords: ["intermittent fasting calculator", "16 8 fasting schedule", "fasting timer", "eating window calculator", "if schedule"],
    popular: true,
    related: ["meal-plan-generator", "calorie-calculator", "caffeine-curfew-calculator"],
    live: true
  },
  {
    slug: "meal-plan-generator",
    title: "7-Day Meal Plan Generator",
    blurb: "Turn your calorie and macro targets into a free, personalized week of meals with a grocery list.",
    category: "nutrition",
    icon: "utensils",
    gradient: "orange",
    keywords: ["meal plan", "7 day meal plan", "free meal plan", "high protein meal plan generator", "keto meal plan free", "meal plan to lose weight"],
    popular: true,
    related: ["macro-calculator", "calorie-calculator", "protein-intake-calculator"],
    live: true
  },
  {
    slug: "muscle-preservation-calculator",
    title: "Muscle Preservation Calculator",
    blurb: "Keep muscle while losing weight \u2014 get your protein target, a muscle-loss risk check, and an action plan.",
    category: "nutrition",
    icon: "beef",
    gradient: "orange",
    keywords: ["keep muscle while losing weight", "prevent muscle loss", "glp-1 muscle loss protein", "protein to keep muscle", "muscle preservation"],
    popular: true,
    related: ["protein-intake-calculator", "macro-calculator", "calorie-deficit-calculator"],
    live: true
  },
  {
    slug: "calorie-calculator",
    title: "Calorie Calculator",
    blurb: "Find your daily calorie target (TDEE) for losing, maintaining, or gaining weight.",
    category: "nutrition",
    icon: "flame",
    gradient: "orange",
    keywords: ["calories", "daily calories", "tdee", "maintenance calories", "weight loss"],
    popular: true,
    live: true
  },
  {
    slug: "macro-calculator",
    title: "Macro Calculator",
    blurb: "Split your calories into protein, carbs, and fat that fit your goal.",
    category: "nutrition",
    icon: "pie-chart",
    gradient: "orange",
    keywords: ["macros", "macronutrients", "protein carbs fat", "iifym"],
    popular: true,
    live: true
  },
  {
    slug: "protein-intake-calculator",
    title: "Protein Intake Calculator",
    blurb: "Get your daily protein target based on body weight and activity.",
    category: "nutrition",
    icon: "egg",
    gradient: "orange",
    keywords: ["protein", "protein intake", "grams of protein"],
    live: true
  },
  {
    slug: "water-intake-calculator",
    title: "Water Intake Calculator",
    blurb: "Find how much water to drink each day, in liters and fluid ounces.",
    category: "nutrition",
    icon: "droplet",
    gradient: "cyan",
    keywords: ["water intake", "hydration", "daily water", "liters", "ounces"],
    popular: true,
    live: true
  },
  {
    slug: "calorie-deficit-calculator",
    title: "Calorie Deficit Calculator",
    blurb: "See the daily deficit needed to lose a target weight by your chosen date.",
    category: "nutrition",
    icon: "trending-down",
    gradient: "orange",
    keywords: ["calorie deficit", "deficit calculator", "weight loss calories"],
    live: true
  },
  {
    slug: "keto-calculator",
    title: "Keto Calculator",
    blurb: "Get your ketogenic macros (70/25/5) and daily net carb limit.",
    category: "nutrition",
    icon: "wheat",
    gradient: "amber",
    keywords: ["keto", "ketogenic", "keto macros", "net carbs", "low carb"],
    live: true
  },
  {
    slug: "bmr-calculator",
    title: "BMR Calculator",
    blurb: "Calculate the calories your body burns completely at rest.",
    category: "body-weight",
    icon: "flame",
    gradient: "blue",
    keywords: ["bmr", "basal metabolic rate", "resting calories"],
    live: true
  },
  // ---- Body & Weight ----
  {
    slug: "weight-loss-timeline-calculator",
    title: "Weight Loss Timeline Calculator",
    blurb: "See a realistic goal date and a weight-over-time chart at a safe, sustainable pace.",
    category: "body-weight",
    icon: "calendar-clock",
    gradient: "blue",
    keywords: ["weight loss timeline calculator", "how long to lose weight", "weight loss goal date", "weight loss predictor", "goal weight date"],
    popular: true,
    related: ["calorie-deficit-calculator", "calorie-calculator", "weight-loss-percentage-calculator"],
    live: true
  },
  {
    slug: "bmi-calculator",
    title: "BMI Calculator",
    blurb: "Check your body mass index and what your healthy weight range looks like.",
    category: "body-weight",
    icon: "scale",
    gradient: "blue",
    keywords: ["bmi", "body mass index", "healthy weight"],
    popular: true,
    live: true
  },
  {
    slug: "body-fat-calculator",
    title: "Body Fat Calculator",
    blurb: "Estimate your body fat percentage using the U.S. Navy method.",
    category: "body-weight",
    icon: "percent",
    gradient: "blue",
    keywords: ["body fat", "body fat percentage", "navy method"],
    popular: true,
    live: true
  },
  {
    slug: "ideal-weight-calculator",
    title: "Ideal Weight Calculator",
    blurb: "See your healthy weight range from BMI and the Devine formula.",
    category: "body-weight",
    icon: "target",
    gradient: "blue",
    keywords: ["ideal weight", "healthy weight", "goal weight", "devine formula"],
    live: true
  },
  {
    slug: "lean-body-mass-calculator",
    title: "Lean Body Mass Calculator",
    blurb: "Find how much of your weight is muscle, bone, and organs \u2014 not fat.",
    category: "body-weight",
    icon: "dumbbell",
    gradient: "blue",
    keywords: ["lean body mass", "lbm", "fat free mass", "boer formula"],
    live: true
  },
  {
    slug: "waist-to-height-ratio-calculator",
    title: "Waist-to-Height Ratio Calculator",
    blurb: "A quick check of central fat risk \u2014 your waist should be under half your height.",
    category: "body-weight",
    icon: "ruler",
    gradient: "blue",
    keywords: ["waist to height ratio", "whtr", "central obesity"],
    live: true
  },
  {
    slug: "waist-to-hip-ratio-calculator",
    title: "Waist-to-Hip Ratio Calculator",
    blurb: "Measure body-shape health risk with your waist and hip measurements.",
    category: "body-weight",
    icon: "person-standing",
    gradient: "blue",
    keywords: ["waist to hip ratio", "whr", "body shape"],
    live: true
  },
  {
    slug: "weight-loss-percentage-calculator",
    title: "Weight Loss Percentage Calculator",
    blurb: "See what percentage of your starting weight you\u2019ve lost so far.",
    category: "body-weight",
    icon: "trending-down",
    gradient: "blue",
    keywords: ["weight loss percentage", "percent weight lost", "progress"],
    live: true
  },
  // ---- Fitness ----
  {
    slug: "walk-it-off-calculator",
    title: "Walk It Off Calculator",
    blurb: "Enter a food or calories to see the minutes of walking, running, or cycling to burn it.",
    category: "fitness",
    icon: "cookie",
    gradient: "green",
    keywords: ["walk it off calculator", "how long to walk off food", "food to exercise calculator", "calories to steps", "burn off calories"],
    popular: true,
    related: ["steps-to-calories-calculator", "calories-burned-calculator", "running-pace-calculator"],
    live: true
  },
  {
    slug: "strength-program-builder",
    title: "Strength Program Builder",
    blurb: "Turn your 1RM into a free 4-week progressive-overload plan with exact working weights.",
    category: "fitness",
    icon: "trending-up",
    gradient: "green",
    keywords: ["workout plan generator", "progressive overload calculator", "4 week strength program", "free workout program", "periodization"],
    popular: true,
    related: ["one-rep-max-calculator", "calories-burned-calculator", "protein-intake-calculator"],
    live: true
  },
  {
    slug: "sitting-disease-reversal-calculator",
    title: "Sitting Disease Reversal Calculator",
    blurb: "Offset desk time with micro-breaks and extra NEAT steps \u2014 get a personalized movement recipe.",
    category: "fitness",
    icon: "armchair",
    gradient: "green",
    keywords: ["sitting too much calculator", "how many steps to offset sitting", "neat calculator", "sitting disease", "sedentary lifestyle"],
    popular: true,
    related: ["steps-to-calories-calculator", "calories-burned-calculator", "target-heart-rate-calculator"],
    live: true
  },
  {
    slug: "one-rep-max-calculator",
    title: "One-Rep Max Calculator",
    blurb: "Estimate your 1RM with Epley and Brzycki, plus a full % training table.",
    category: "fitness",
    icon: "dumbbell",
    gradient: "green",
    keywords: ["one rep max", "1rm", "max lift", "strength", "epley", "brzycki"],
    popular: true,
    live: true
  },
  {
    slug: "running-pace-calculator",
    title: "Running Pace Calculator",
    blurb: "Solve pace, finish time, or distance \u2014 and see your splits.",
    category: "fitness",
    icon: "timer",
    gradient: "green",
    keywords: ["running pace", "pace calculator", "marathon time", "splits"],
    live: true
  },
  {
    slug: "calories-burned-calculator",
    title: "Calories Burned Calculator",
    blurb: "Estimate calories burned by activity using MET values and your weight.",
    category: "fitness",
    icon: "flame",
    gradient: "green",
    keywords: ["calories burned", "exercise calories", "met"],
    live: true
  },
  {
    slug: "vo2-max-calculator",
    title: "VO\u2082 Max Calculator",
    blurb: "Estimate your cardio fitness from your resting and max heart rate.",
    category: "fitness",
    icon: "wind",
    gradient: "green",
    keywords: ["vo2 max", "cardio fitness", "aerobic capacity", "uth sorensen"],
    live: true
  },
  {
    slug: "steps-to-calories-calculator",
    title: "Steps to Calories Calculator",
    blurb: "Turn your step count into distance walked and calories burned.",
    category: "fitness",
    icon: "footprints",
    gradient: "green",
    keywords: ["steps to calories", "step calculator", "walking calories", "distance"],
    live: true
  },
  // ---- Heart & Vitals ----
  {
    slug: "target-heart-rate-calculator",
    title: "Target Heart Rate Calculator",
    blurb: "Find your five heart-rate training zones for fat burn and cardio.",
    category: "heart-vitals",
    icon: "activity",
    gradient: "red",
    keywords: ["target heart rate", "heart rate zones", "cardio zone", "karvonen"],
    popular: true,
    live: true
  },
  {
    slug: "max-heart-rate-calculator",
    title: "Max Heart Rate Calculator",
    blurb: "Estimate your maximum heart rate from your age.",
    category: "heart-vitals",
    icon: "heart",
    gradient: "red",
    keywords: ["max heart rate", "mhr", "maximum heart rate", "tanaka"],
    live: true
  },
  {
    slug: "blood-pressure-checker",
    title: "Blood Pressure Checker",
    blurb: "See which AHA blood-pressure category your reading falls into.",
    category: "heart-vitals",
    icon: "gauge",
    gradient: "red",
    keywords: ["blood pressure", "bp category", "hypertension", "aha"],
    live: true
  },
  {
    slug: "resting-heart-rate-checker",
    title: "Resting Heart Rate Checker",
    blurb: "Compare your resting heart rate against healthy age and sex benchmarks.",
    category: "heart-vitals",
    icon: "heart-pulse",
    gradient: "red",
    keywords: ["resting heart rate", "rhr", "pulse", "normal heart rate", "resting heart rate by age"],
    related: ["target-heart-rate-calculator", "max-heart-rate-calculator", "vo2-max-calculator"],
    live: true
  },
  // ---- Metabolic Health ----
  {
    slug: "metabolic-age-calculator",
    title: "Metabolic Age Calculator",
    blurb: "Estimate your metabolic age from your BMR vs the average for your age (illustrative).",
    category: "metabolic",
    icon: "gauge",
    gradient: "teal",
    keywords: ["metabolic age", "metabolism", "bmr age", "metabolic age calculator", "how old is my metabolism"],
    related: ["bmr-calculator", "calorie-calculator", "macro-calculator"],
    live: true
  },
  {
    slug: "alcohol-calorie-calculator",
    title: "Alcohol Calorie Calculator",
    blurb: "Add up the hidden calories in your weekly drinks \u2014 per week, month, and year.",
    category: "metabolic",
    icon: "wine",
    gradient: "amber",
    keywords: ["alcohol calories", "drink calories", "beer wine calories", "calories in alcohol", "alcohol calorie calculator"],
    related: ["alcohol-units-calculator", "calorie-calculator", "calorie-deficit-calculator"],
    live: true
  },
  // ---- Women's Health ----
  {
    slug: "due-date-calculator",
    title: "Pregnancy Due Date Calculator",
    blurb: "Estimate your due date from your last period, conception, or IVF transfer.",
    category: "womens-health",
    icon: "baby",
    gradient: "pink",
    keywords: ["due date", "pregnancy", "edd", "gestation", "naegele"],
    popular: true,
    live: true
  },
  {
    slug: "pregnancy-week-calculator",
    title: "Pregnancy Week-by-Week",
    blurb: "See your current gestational week and what\u2019s developing right now.",
    category: "womens-health",
    icon: "calendar-days",
    gradient: "pink",
    keywords: ["pregnancy week", "gestational age", "week by week"],
    live: true
  },
  {
    slug: "ovulation-calculator",
    title: "Ovulation Calculator",
    blurb: "Predict your ovulation and fertile window from your cycle length.",
    category: "womens-health",
    icon: "calendar-heart",
    gradient: "pink",
    keywords: ["ovulation", "fertile window", "fertility"],
    popular: true,
    live: true
  },
  {
    slug: "period-calculator",
    title: "Period Calculator",
    blurb: "Predict your next three periods from your cycle length.",
    category: "womens-health",
    icon: "droplet",
    gradient: "pink",
    keywords: ["period", "menstrual cycle", "period tracker"],
    live: true
  },
  {
    slug: "pregnancy-weight-gain-calculator",
    title: "Pregnancy Weight Gain Calculator",
    blurb: "See your recommended weight-gain range by pre-pregnancy BMI (IOM).",
    category: "womens-health",
    icon: "weight",
    gradient: "pink",
    keywords: ["pregnancy weight gain", "gestational weight", "iom"],
    live: true
  },
  // ---- Sleep & Recovery ----
  {
    slug: "sleep-chronotype-quiz",
    title: "Sleep Chronotype Quiz",
    blurb: "Are you a Lion, Bear, Wolf, or Dolphin? Find your type and your ideal daily schedule.",
    category: "sleep",
    icon: "moon-star",
    gradient: "purple",
    keywords: ["sleep chronotype quiz", "chronotype test", "lion bear wolf dolphin", "am i a morning person", "sleep type"],
    popular: true,
    related: ["caffeine-curfew-calculator", "sleep-calculator", "sleep-debt-calculator"],
    live: true
  },
  {
    slug: "caffeine-intake-calculator",
    title: "Caffeine Intake Calculator",
    blurb: "Add up your daily caffeine from coffee, tea, and energy drinks vs the ~400 mg safe limit.",
    category: "sleep",
    icon: "coffee",
    gradient: "brown",
    keywords: ["caffeine calculator", "how much caffeine per day", "caffeine tracker", "daily caffeine limit", "400 mg caffeine"],
    popular: true,
    related: ["caffeine-curfew-calculator", "sleep-calculator", "sleep-quality-check"],
    live: true
  },
  {
    slug: "caffeine-curfew-calculator",
    title: "Caffeine Curfew Calculator",
    blurb: "See when to stop caffeine and how to time light for better sleep \u2014 with a shareable daily timeline.",
    category: "sleep",
    icon: "clock",
    gradient: "brown",
    keywords: ["caffeine cutoff calculator", "when to stop drinking coffee before bed", "circadian rhythm calculator", "caffeine curfew", "caffeine half life"],
    popular: true,
    related: ["sleep-calculator", "sleep-debt-calculator", "nap-calculator"],
    live: true
  },
  {
    slug: "sleep-calculator",
    title: "Sleep Calculator",
    blurb: "Find the best bedtime or wake-up time using 90-minute sleep cycles.",
    category: "sleep",
    icon: "moon",
    gradient: "purple",
    keywords: ["sleep calculator", "sleep cycle", "bedtime", "wake up time"],
    popular: true,
    live: true
  },
  {
    slug: "nap-calculator",
    title: "Nap Calculator",
    blurb: "Get the ideal wake-up time for a power nap or a full sleep cycle.",
    category: "sleep",
    icon: "bed",
    gradient: "purple",
    keywords: ["nap calculator", "power nap", "nap time"],
    live: true
  },
  {
    slug: "sleep-debt-calculator",
    title: "Sleep Debt Calculator",
    blurb: "Add up the sleep you owe over a week and how to repay it.",
    category: "sleep",
    icon: "alarm-clock",
    gradient: "purple",
    keywords: ["sleep debt", "sleep deficit", "catch up on sleep"],
    live: true
  },
  // ---- Health Risk (educational, non-diagnostic) ----
  {
    slug: "lifestyle-age-test",
    title: "Lifestyle Age Test",
    blurb: "See how your habits may be aging your body vs your real age \u2014 an educational, shareable estimate.",
    category: "health-risk",
    icon: "hourglass",
    gradient: "amber",
    keywords: ["biological age calculator", "how old is my body", "real age test", "body age test", "lifestyle age"],
    popular: true,
    related: ["waist-to-height-ratio-calculator", "heart-disease-risk-calculator", "resting-heart-rate-checker"],
    live: true
  },
  {
    slug: "waist-health-risk-calculator",
    title: "Waist-Based Health Risk",
    blurb: "Combine your BMI and waist-to-height ratio into a risk-level explainer.",
    category: "health-risk",
    icon: "ruler",
    gradient: "amber",
    keywords: ["health risk", "bmi waist", "waist to height", "obesity risk"],
    live: true
  },
  {
    slug: "heart-disease-risk-calculator",
    title: "Heart Disease Risk (Educational)",
    blurb: "An educational lifestyle-based heart risk estimate \u2014 not a diagnosis.",
    category: "health-risk",
    icon: "heart",
    gradient: "amber",
    keywords: ["heart disease risk", "cardiovascular risk", "lifestyle risk"],
    live: true
  },
  {
    slug: "diabetes-risk-calculator",
    title: "Type 2 Diabetes Risk (Educational)",
    blurb: "A non-diagnostic diabetes risk band \u2014 and why to get screened.",
    category: "health-risk",
    icon: "droplet",
    gradient: "amber",
    keywords: ["diabetes risk", "type 2 diabetes", "prediabetes risk"],
    live: true
  },
  {
    slug: "smoking-cost-calculator",
    title: "Smoking Cost Calculator",
    blurb: "See what smoking costs you over time \u2014 and the benefits of quitting.",
    category: "health-risk",
    icon: "cigarette",
    gradient: "amber",
    keywords: ["smoking cost", "cost of smoking", "quit smoking savings"],
    live: true
  },
  {
    slug: "alcohol-units-calculator",
    title: "Alcohol Units Calculator",
    blurb: "Convert your weekly drinks into units and check low-risk guidelines.",
    category: "health-risk",
    icon: "beer",
    gradient: "amber",
    keywords: ["alcohol units", "drink units", "low risk drinking"],
    live: true
  },
  // ---- Mental Wellness (self-reflection, not diagnostic) ----
  {
    slug: "sleep-quality-check",
    title: "Sleep Quality Self-Check",
    blurb: "A short check-in on how restful your sleep has been, with tips.",
    category: "mental-wellness",
    icon: "moon",
    gradient: "sky",
    keywords: ["sleep quality", "sleep self check", "sleep hygiene"],
    live: true
  },
  {
    slug: "stress-level-check",
    title: "Stress Level Self-Check",
    blurb: "Reflect on your stress with a few questions and coping ideas.",
    category: "mental-wellness",
    icon: "gauge",
    gradient: "sky",
    keywords: ["stress check", "stress level", "coping"],
    live: true
  },
  {
    slug: "burnout-self-check",
    title: "Burnout Self-Check",
    blurb: "A gentle reflection on energy and workload \u2014 and where to get support.",
    category: "mental-wellness",
    icon: "battery-low",
    gradient: "sky",
    keywords: ["burnout", "burnout check", "work stress"],
    live: true
  },
  {
    slug: "box-breathing-timer",
    title: "Box Breathing Timer",
    blurb: "A guided 4-4-4-4 and 4-7-8 breathing tool to help you calm down.",
    category: "mental-wellness",
    icon: "wind",
    gradient: "sky",
    keywords: ["box breathing", "breathing timer", "4-7-8 breathing", "calm"],
    live: true
  }
];
var TOTAL_TOOLS = TOOLS.length;
var getTool = (slug) => TOOLS.find((t) => t.slug === slug);
var getToolsByCategory = (categoryId) => TOOLS.filter((t) => t.category === categoryId);
var countByCategory = (categoryId) => getToolsByCategory(categoryId).length;
var getLiveTools = () => TOOLS.filter((t) => t.live);
var isToolLive = (slug) => !!getTool(slug)?.live;
var getPopularTools = (limit = 6) => TOOLS.filter((t) => t.popular).slice(0, limit);
var AFFINITY = {
  nutrition: ["body-weight", "fitness"],
  "body-weight": ["nutrition", "fitness"],
  fitness: ["heart-vitals", "nutrition"],
  "heart-vitals": ["fitness", "health-risk"],
  metabolic: ["nutrition", "body-weight"],
  sleep: ["mental-wellness", "health-risk"],
  "womens-health": ["body-weight", "nutrition"],
  "health-risk": ["heart-vitals", "mental-wellness"],
  "mental-wellness": ["sleep", "health-risk"]
};
var getRelatedTools = (slug, limit = 4) => {
  const tool = getTool(slug);
  if (!tool) return [];
  const out = [];
  const push = (t) => {
    if (t && t.live && t.slug !== slug && !out.includes(t)) out.push(t);
  };
  (tool.related ?? []).forEach((s) => push(getTool(s)));
  const sameLimit = Math.max(1, limit - 1);
  for (const t of getToolsByCategory(tool.category)) {
    if (out.length >= sameLimit) break;
    push(t);
  }
  for (const cat of AFFINITY[tool.category] ?? []) {
    if (out.length >= limit) break;
    const cross = getToolsByCategory(cat).filter((t) => t.live);
    push(cross.find((t) => t.popular) ?? cross[0]);
  }
  for (const t of getToolsByCategory(tool.category)) {
    if (out.length >= limit) break;
    push(t);
  }
  for (const t of getLiveTools()) {
    if (out.length >= limit) break;
    push(t);
  }
  return out.slice(0, limit);
};

// src/data/articles.ts
var articles_exports = {};
__export(articles_exports, {
  ARTICLES: () => ARTICLES,
  ARTICLES_PER_PAGE: () => ARTICLES_PER_PAGE,
  ARTICLE_CATEGORIES: () => ARTICLE_CATEGORIES,
  ARTICLE_REVIEW: () => ARTICLE_REVIEW,
  articleFaq: () => articleFaq,
  articlePlainText: () => articlePlainText,
  countArticlesByCategory: () => countArticlesByCategory,
  getArticle: () => getArticle,
  getArticleCategory: () => getArticleCategory,
  getArticlesByCategory: () => getArticlesByCategory,
  getArticlesForTool: () => getArticlesForTool,
  getFeaturedArticle: () => getFeaturedArticle,
  getLatestArticles: () => getLatestArticles,
  getRelatedArticles: () => getRelatedArticles
});

// src/lib/text.ts
function stripInline(md) {
  return md.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

// src/data/articles.ts
var ARTICLE_CATEGORIES = [
  { id: "nutrition", name: "Nutrition", slug: "nutrition", blurb: "Calories, protein, and eating well without the guesswork.", icon: "leaf", color: "#f97316" },
  { id: "weight-loss", name: "Weight Loss", slug: "weight-loss", blurb: "Evidence-based, sustainable fat loss \u2014 no crash diets.", icon: "scale", color: "#3b82f6" },
  { id: "fitness", name: "Fitness", slug: "fitness", blurb: "Training, strength, and getting more from your workouts.", icon: "dumbbell", color: "#8b5cf6" },
  { id: "sleep", name: "Sleep", slug: "sleep", blurb: "Better rest, cycles, and recovery, backed by research.", icon: "moon", color: "#6366f1" },
  { id: "womens-health", name: "Women's Health", slug: "womens-health", blurb: "Cycle, fertility, and pregnancy, explained clearly.", icon: "sparkle", color: "#ec4899" },
  { id: "heart-health", name: "Heart Health", slug: "heart-health", blurb: "Heart rate, blood pressure, and cardiovascular basics.", icon: "heart-pulse", color: "#ef4444" },
  { id: "mental-wellness", name: "Mental Wellness", slug: "mental-wellness", blurb: "Stress, burnout, and everyday calm.", icon: "smile", color: "#0ea5e9" }
];
var ARTICLES = [
  // 1 ----------------------------------------------------------------------
  {
    slug: "how-many-calories-to-lose-weight",
    title: "How Many Calories Should I Eat to Lose Weight?",
    seoTitle: "How Many Calories to Lose Weight? | Simple Guide",
    metaDescription: "Learn how to find your calorie target for weight loss using your TDEE and a safe deficit \u2014 plus why crash diets backfire. Free calculators included.",
    category: "weight-loss",
    excerpt: "Weight loss comes down to a calorie deficit \u2014 but the right number is personal. Here is how to find a target that actually works, and stays safe.",
    author: "HealthyLifeStyles Editorial Team",
    publishDate: "2026-04-12",
    updatedDate: "2026-06-10",
    featured: true,
    primaryTool: "calorie-calculator",
    relatedTools: ["calorie-calculator", "calorie-deficit-calculator", "macro-calculator", "bmr-calculator"],
    relatedArticles: ["how-much-protein-do-i-need", "how-to-keep-muscle-while-losing-weight"],
    sources: [
      { citation: "Mifflin MD, St Jeor ST, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990.", url: "https://pubmed.ncbi.nlm.nih.gov/2305711/" },
      { citation: "National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK). Body Weight Planner.", url: "https://www.niddk.nih.gov/bwp" },
      { citation: "CDC. Losing Weight \u2014 healthy weight loss is about 1 to 2 pounds per week.", url: "https://www.cdc.gov/healthyweight/losing_weight/index.html" }
    ],
    body: [
      { type: "p", text: "If you want to lose weight, you have to eat fewer calories than your body burns. That is the whole mechanism \u2014 a **calorie deficit**. The hard part is not the principle; it is finding a daily number that is low enough to make progress but high enough to be sustainable, protect your muscle, and keep you sane." },
      { type: "p", text: "This guide shows you how to set that number from your own body and activity, in three steps." },
      { type: "h2", text: "Step 1: Find your maintenance calories (TDEE)" },
      { type: "p", text: "Your **TDEE** (Total Daily Energy Expenditure) is roughly how many calories you burn in a day. It is the sum of your resting metabolism (the energy to keep you alive \u2014 your [BMR](/tools/bmr-calculator)) plus everything you do on top of that. Most evidence-based calculators estimate it with the Mifflin-St Jeor equation, then multiply by an activity factor." },
      { type: "p", text: "Eat at your TDEE and your weight holds steady. Eat below it and you lose. So your maintenance number is the anchor for everything else." },
      { type: "tool", slug: "calorie-calculator", label: "Find your calorie target" },
      { type: "h2", text: "Step 2: Subtract a safe deficit" },
      { type: "p", text: "A pound of fat stores roughly 3,500 calories, so a daily deficit of 500 calories trends toward about a pound of loss per week. The [CDC](https://www.cdc.gov/healthyweight/losing_weight/index.html) considers **1 to 2 pounds (about 0.5\u20131 kg) per week** a healthy, sustainable pace." },
      { type: "ul", items: [
        "**Modest deficit (about 250/day):** slow but very easy to maintain \u2014 good if you have less to lose.",
        "**Standard deficit (about 500/day):** ~1 lb/week; the sweet spot for most people.",
        "**Aggressive deficit (750+/day):** faster, but harder to stick to and more likely to cost you muscle."
      ] },
      { type: "p", text: "You can let a tool do the subtraction for you: the [Calorie Deficit Calculator](/tools/calorie-deficit-calculator) works backward from a goal weight and date to show the daily deficit required \u2014 and flags it if that pace is too aggressive." },
      { type: "callout", tone: "warning", title: "Never go below the floor", text: "Very-low-calorie diets backfire: you lose muscle, your metabolism adapts, and the weight tends to return. As a general rule, do not drop below about 1,200 calories/day for women or 1,500 for men without medical supervision, and avoid losing more than ~1% of your body weight per week." },
      { type: "h2", text: "Step 3: Keep protein high and adjust monthly" },
      { type: "p", text: "Calories decide whether you lose weight; protein and training decide whether that loss is fat or muscle. Keep protein high (see [how much protein you really need](/wellness-hub/how-much-protein-do-i-need)) and lift something heavy a few times a week. Then re-check your numbers every 3\u20134 weeks \u2014 as you get lighter, your TDEE falls, so the deficit that worked at the start will eventually stall." },
      { type: "h3", text: "What to do when you plateau" },
      { type: "ul", items: [
        "Recalculate your TDEE at your new weight \u2014 your target should drop a little.",
        "Tighten up tracking for two weeks; portions creep over time.",
        "Add movement (steps) rather than cutting calories further.",
        "Take a planned maintenance break \u2014 a week at TDEE can help adherence."
      ] },
      { type: "paa", items: [
        { q: "How many calories should I eat a day to lose weight?", a: "Start from your maintenance calories (TDEE) and subtract 250\u2013500 per day for a sustainable 0.5\u20131 lb weekly loss. The exact number depends on your age, sex, size, and activity \u2014 calculate your TDEE first, then subtract." },
        { q: "Is 1,200 calories a day enough?", a: "1,200 is widely treated as the lowest safe target for women (about 1,500 for men) and is too low for many active people. If a calculator suggests going below that, raise the calories and lose weight more slowly instead." },
        { q: "Why am I not losing weight in a calorie deficit?", a: "The most common reasons are under-counting calories, a TDEE estimate that is too high, water-weight fluctuations masking fat loss, or your deficit shrinking as you get lighter. Re-measure, tighten tracking, and give it 2\u20133 weeks." },
        { q: "Do I need to count calories forever?", a: "No. Counting is a learning tool. Most people track for a few months to calibrate portion sizes, then maintain with awareness rather than weighing everything." }
      ] },
      { type: "p", text: "Bottom line: find your TDEE, subtract a deficit you can live with, keep protein high, and re-check monthly. Slow and steady genuinely wins here." }
    ]
  },
  // 2 ----------------------------------------------------------------------
  {
    slug: "how-much-protein-do-i-need",
    title: "How Much Protein Do I Really Need?",
    seoTitle: "How Much Protein Do I Really Need? | Daily Guide",
    metaDescription: "How much protein per day for muscle, weight loss, or general health \u2014 in grams per kg and pound, with what the research actually says.",
    category: "nutrition",
    excerpt: "The RDA is a floor, not a goal. Here is how much protein the evidence supports for muscle, fat loss, and healthy aging \u2014 and how to hit it.",
    author: "HealthyLifeStyles Editorial Team",
    publishDate: "2026-03-05",
    updatedDate: "2026-05-28",
    primaryTool: "protein-intake-calculator",
    relatedTools: ["protein-intake-calculator", "macro-calculator", "calorie-calculator"],
    relatedArticles: ["how-many-calories-to-lose-weight", "how-to-keep-muscle-while-losing-weight"],
    sources: [
      { citation: "Institute of Medicine. Dietary Reference Intakes: protein RDA 0.8 g/kg/day.", url: "https://www.ncbi.nlm.nih.gov/books/NBK56068/" },
      { citation: "J\xE4ger R, et al. ISSN Position Stand: Protein and Exercise. J Int Soc Sports Nutr. 2017.", url: "https://pubmed.ncbi.nlm.nih.gov/28642676/" },
      { citation: "Morton RW, et al. Systematic review of protein and resistance-training adaptations. Br J Sports Med. 2018.", url: "https://pubmed.ncbi.nlm.nih.gov/28698222/" }
    ],
    body: [
      { type: "p", text: "The official **RDA for protein is 0.8 grams per kilogram of body weight per day** \u2014 but that is the amount set to prevent deficiency in a sedentary adult, not the amount that is optimal if you exercise, are trying to lose fat, or want to age strongly. For most active people, the research supports quite a bit more." },
      { type: "h2", text: "What the research recommends" },
      { type: "p", text: "The [International Society of Sports Nutrition](https://pubmed.ncbi.nlm.nih.gov/28642676/) and a large [2018 meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28698222/) converge on a practical range:" },
      { type: "ul", items: [
        "**General health (sedentary):** 0.8\u20131.0 g/kg \u2014 the baseline.",
        "**Active / building muscle:** 1.4\u20132.0 g/kg (about 0.6\u20130.9 g per pound).",
        "**Losing fat while preserving muscle:** 1.6\u20132.4 g/kg \u2014 protein needs go up, not down, in a deficit.",
        "**Older adults:** 1.0\u20131.2 g/kg to push back against age-related muscle loss."
      ] },
      { type: "p", text: "In plain terms: a 70 kg (154 lb) active person lands around 100\u2013140 g of protein per day. Round numbers are fine \u2014 protein targets are a range, not a knife-edge." },
      { type: "tool", slug: "protein-intake-calculator", label: "Calculate your protein target" },
      { type: "callout", tone: "tip", title: "Spread it across the day", text: "Aim for roughly 20\u201340 g of protein per meal across 3\u20134 meals rather than one giant serving. Even distribution gives a slightly better muscle-building response than back-loading it all at dinner." },
      { type: "h2", text: "Is too much protein dangerous?" },
      { type: "p", text: "For healthy people with healthy kidneys, higher-protein diets within these ranges are well tolerated in the research, with no evidence of harm to bone or kidney function. The usual caveat applies to anyone with **existing kidney disease**, who should follow their doctor\u2019s advice on protein. If that is you, talk to your clinician before increasing intake." },
      { type: "h3", text: "Easy ways to hit your number" },
      { type: "ul", items: [
        "Anchor every meal with a protein source (eggs, dairy, poultry, fish, tofu, legumes).",
        "Use Greek yogurt, cottage cheese, or a shake to close a gap at the end of the day.",
        "Read labels by grams of protein per serving, not marketing claims.",
        "Plant-based? Combine sources (beans + grains) and aim toward the higher end of your range."
      ] },
      { type: "p", text: "Once you know your protein target, the [Macro Calculator](/tools/macro-calculator) fits carbs and fat around it for your goal, and the [Calorie Calculator](/tools/calorie-calculator) sets the total energy budget." },
      { type: "paa", items: [
        { q: "How much protein per day to build muscle?", a: "Most evidence points to 1.6\u20132.2 g/kg of body weight per day (roughly 0.7\u20131.0 g per pound) combined with resistance training. Going much higher offers little extra benefit." },
        { q: "How much protein do I need to lose weight?", a: "Higher than maintenance \u2014 about 1.6\u20132.4 g/kg \u2014 because adequate protein in a calorie deficit preserves muscle and keeps you fuller, so more of the weight you lose is fat." },
        { q: "Can I eat too much protein in one sitting?", a: "Your body uses protein efficiently across the day; very large single servings are not wasted, but spreading protein over 3\u20134 meals slightly improves muscle protein synthesis." }
      ] }
    ]
  },
  // 3 ----------------------------------------------------------------------
  {
    slug: "healthy-bmi-by-age",
    title: "What's a Healthy BMI by Age?",
    seoTitle: "Healthy BMI by Age: What the Numbers Mean",
    metaDescription: "What counts as a healthy BMI, how it changes with age, and the limits of BMI for athletes and older adults \u2014 with a free BMI calculator.",
    category: "weight-loss",
    excerpt: "BMI is a useful screening number, but it does not mean the same thing at 25, 55, and 75. Here is how to read it by age \u2014 and what it misses.",
    author: "HealthyLifeStyles Editorial Team",
    publishDate: "2026-02-18",
    updatedDate: "2026-06-02",
    primaryTool: "bmi-calculator",
    relatedTools: ["bmi-calculator", "waist-to-height-ratio-calculator", "body-fat-calculator", "ideal-weight-calculator"],
    relatedArticles: ["how-many-calories-to-lose-weight"],
    sources: [
      { citation: "World Health Organization. Body mass index (BMI) classification.", url: "https://www.who.int/health-topics/obesity" },
      { citation: "CDC. About Adult BMI.", url: "https://www.cdc.gov/healthyweight/assessing/bmi/adult_bmi/index.html" },
      { citation: "Winter JE, et al. BMI and all-cause mortality in older adults: a meta-analysis. Am J Clin Nutr. 2014.", url: "https://pubmed.ncbi.nlm.nih.gov/24452240/" }
    ],
    body: [
      { type: "p", text: "**BMI (Body Mass Index)** is your weight divided by your height squared. It is a quick screening tool that sorts adults into ranges \u2014 but the standard cut-offs were set for the general adult population, and they do not capture the whole picture at every age." },
      { type: "h2", text: "The standard adult BMI ranges" },
      { type: "p", text: "For adults aged roughly 20\u201365, the [WHO](https://www.who.int/health-topics/obesity) and [CDC](https://www.cdc.gov/healthyweight/assessing/bmi/adult_bmi/index.html) use the same categories regardless of age or sex:" },
      { type: "ul", items: [
        "Under 18.5 \u2014 underweight",
        "18.5 to 24.9 \u2014 healthy weight",
        "25.0 to 29.9 \u2014 overweight",
        "30.0 and above \u2014 obesity"
      ] },
      { type: "tool", slug: "bmi-calculator", label: "Check your BMI" },
      { type: "h2", text: "Does a healthy BMI change with age?" },
      { type: "p", text: 'The official cut-offs do **not** change with age for adults \u2014 a BMI of 23 is "healthy weight" at 25 and at 75. What changes is the *interpretation*:' },
      { type: "h3", text: "Older adults (65+)" },
      { type: "p", text: 'In older adults, being at the very low end of "healthy" is not always best. [Research in adults over 65](https://pubmed.ncbi.nlm.nih.gov/24452240/) has linked a slightly higher BMI (in the mid-20s) with lower mortality, partly because some reserve weight is protective during illness and because muscle loss (sarcopenia) can make a "normal" BMI hide low strength.' },
      { type: "h3", text: "Children and teens" },
      { type: "p", text: "BMI for anyone under 20 is **not** read against the adult ranges at all. It is plotted as an age-and-sex percentile on growth charts, so the adult cut-offs above simply do not apply." },
      { type: "callout", tone: "info", title: "BMI is a screen, not a diagnosis", text: 'BMI cannot tell muscle from fat or show where you carry weight. A muscular athlete can read "overweight" while being very lean. Pair BMI with your [waist-to-height ratio](/tools/waist-to-height-ratio-calculator) and, if you want, a [body-fat estimate](/tools/body-fat-calculator) for a fuller view.' },
      { type: "h2", text: "A better picture in 30 seconds" },
      { type: "ol", items: [
        "Check your BMI for a baseline category.",
        "Measure your waist \u2014 under half your height is the simple target.",
        "Note your trend over months, not day-to-day weight.",
        "If anything looks off, talk to a clinician rather than self-diagnosing."
      ] },
      { type: "paa", items: [
        { q: "What is a healthy BMI for my age?", a: "For adults, the healthy range is 18.5\u201324.9 at every age. After about 65, sitting in the lower-to-mid 20s is often reasonable, and strength matters as much as the number. Under-20s use growth-chart percentiles instead." },
        { q: "Is BMI accurate for athletes?", a: 'Not very. BMI counts muscle as weight, so lean, muscular people often score "overweight." For them, body-fat percentage and waist measurements are more informative.' },
        { q: "What is a healthy BMI for women vs men?", a: "The BMI ranges are the same for women and men. Body composition differs, which is why waist circumference and body-fat percentage add useful context beyond BMI alone." }
      ] }
    ]
  },
  // 4 ----------------------------------------------------------------------
  {
    slug: "best-time-to-stop-drinking-coffee-for-sleep",
    title: "The Best Time to Stop Drinking Coffee for Better Sleep",
    seoTitle: "When to Stop Drinking Coffee for Better Sleep",
    metaDescription: "Caffeine has a ~5-hour half-life and can disrupt sleep even 6 hours before bed. Here is when to set your last-coffee cutoff \u2014 and how to time bedtime.",
    category: "sleep",
    excerpt: "Caffeine lingers for hours. Research shows even an afternoon coffee can steal sleep. Here is how to set a sensible caffeine curfew.",
    author: "HealthyLifeStyles Editorial Team",
    publishDate: "2026-05-02",
    updatedDate: "2026-06-15",
    primaryTool: "caffeine-curfew-calculator",
    relatedTools: ["caffeine-curfew-calculator", "sleep-calculator", "sleep-debt-calculator"],
    relatedArticles: [],
    sources: [
      { citation: "Drake C, et al. Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. J Clin Sleep Med. 2013.", url: "https://pubmed.ncbi.nlm.nih.gov/24235903/" },
      { citation: "Institute of Medicine / FDA. Caffeine half-life is roughly 5 hours in healthy adults.", url: "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much" },
      { citation: "Clark I, Landolt HP. Coffee, caffeine, and sleep: a systematic review. Sleep Med Rev. 2017.", url: "https://pubmed.ncbi.nlm.nih.gov/26899133/" }
    ],
    body: [
      { type: "p", text: "Caffeine works by blocking adenosine, the molecule that builds up through the day and makes you feel sleepy. The catch is how long it sticks around: caffeine has a **half-life of about 5 hours** in a typical healthy adult. Drink a 200 mg coffee at 4 p.m. and roughly 100 mg is still circulating at 9 p.m." },
      { type: "h2", text: "How late is too late?" },
      { type: "p", text: "A frequently cited [2013 clinical study](https://pubmed.ncbi.nlm.nih.gov/24235903/) gave people caffeine 0, 3, and 6 hours before bed. Even the **6-hours-before-bed dose measurably reduced total sleep** \u2014 and people often did not notice the damage themselves. That is the core problem: caffeine can flatten your sleep quality without making you feel wired." },
      { type: "callout", tone: "tip", title: "A simple rule of thumb", text: 'Set your "caffeine curfew" about 8\u201310 hours before your planned bedtime. If you go to bed at 11 p.m., make your last coffee around 1\u20133 p.m. People who are sensitive to caffeine, or who metabolize it slowly, may need an even earlier cutoff.' },
      { type: "tool", slug: "caffeine-curfew-calculator", label: "Find your caffeine curfew" },
      { type: "h2", text: "Work backward from your bedtime" },
      { type: "p", text: "To set the curfew you first need a target bedtime \u2014 and the easiest way to find one that ends on a natural wake-up is to count in 90-minute sleep cycles from when you have to get up." },
      { type: "tool", slug: "sleep-calculator", label: "Find your ideal bedtime" },
      { type: "p", text: "Once you know your bedtime, subtract 8\u201310 hours for your last coffee. If poor sleep has already piled up, the [Sleep Debt Calculator](/tools/sleep-debt-calculator) shows how much you owe and how to repay it gradually." },
      { type: "h2", text: "Things that change your cutoff" },
      { type: "ul", items: [
        '**Genetics & sensitivity:** "slow metabolizers" clear caffeine far more slowly and should cut off earlier.',
        "**Dose:** a double espresso needs more lead time than a small cup.",
        "**Hidden sources:** tea, cola, energy drinks, pre-workout, dark chocolate, and some painkillers all add up.",
        "**Pregnancy & some medications:** can dramatically slow caffeine clearance \u2014 follow medical advice."
      ] },
      { type: "h3", text: "Better-sleep habits that help more than timing alone" },
      { type: "ul", items: [
        "Get morning daylight to anchor your body clock.",
        "Keep a consistent wake-up time, even on weekends.",
        "Swap the late coffee for decaf or herbal tea to keep the ritual.",
        "Dim screens and lights in the last hour before bed."
      ] },
      { type: "paa", items: [
        { q: "What time should I stop drinking coffee?", a: "Because caffeine has a ~5-hour half-life and can disrupt sleep even 6 hours out, a good default is to stop 8\u201310 hours before bed \u2014 roughly early-to-mid afternoon for an 11 p.m. bedtime." },
        { q: "Does afternoon coffee really affect sleep?", a: "Yes. Controlled research found caffeine taken 6 hours before bed significantly reduced total sleep time, often without the person realizing their sleep had worsened." },
        { q: "How long does caffeine stay in your system?", a: "About half is cleared in roughly 5 hours, but it takes around 10 hours or more to clear most of a dose \u2014 longer in slow metabolizers, during pregnancy, or with certain medications." }
      ] }
    ]
  },
  // 5 ----------------------------------------------------------------------
  {
    slug: "how-to-keep-muscle-while-losing-weight",
    title: "How to Keep Muscle While Losing Weight",
    seoTitle: "How to Keep Muscle While Losing Weight",
    metaDescription: "Lose fat without losing muscle: the three levers that matter most \u2014 a moderate deficit, high protein, and resistance training \u2014 explained simply.",
    category: "fitness",
    excerpt: "Lose weight the wrong way and up to a quarter of it can be muscle. Three evidence-based levers keep the scale moving while protecting your strength.",
    author: "HealthyLifeStyles Editorial Team",
    publishDate: "2026-04-26",
    updatedDate: "2026-06-08",
    primaryTool: "muscle-preservation-calculator",
    relatedTools: ["muscle-preservation-calculator", "protein-intake-calculator", "calorie-deficit-calculator", "one-rep-max-calculator"],
    relatedArticles: ["how-many-calories-to-lose-weight", "how-much-protein-do-i-need"],
    sources: [
      { citation: "Helms ER, et al. Evidence-based recommendations for natural bodybuilding contest prep: nutrition. J Int Soc Sports Nutr. 2014.", url: "https://pubmed.ncbi.nlm.nih.gov/24864135/" },
      { citation: "Longland TM, et al. Higher protein during an energy deficit preserves lean mass. Am J Clin Nutr. 2016.", url: "https://pubmed.ncbi.nlm.nih.gov/26817506/" },
      { citation: "Murphy C, Koehler K. Energy deficiency impairs resistance-training adaptations. Scand J Med Sci Sports. 2022.", url: "https://pubmed.ncbi.nlm.nih.gov/34536305/" }
    ],
    body: [
      { type: "p", text: 'When you lose weight, the scale does not care whether the loss is fat or muscle \u2014 but you should. Lose weight carelessly (big deficit, low protein, no training) and a meaningful share of what you drop can be lean mass, which lowers your metabolism and leaves you "skinny-fat." The good news: keeping muscle while leaning out comes down to three levers.' },
      { type: "tool", slug: "muscle-preservation-calculator", label: "Check your muscle-loss risk" },
      { type: "h2", text: "Lever 1: Keep the deficit moderate" },
      { type: "p", text: 'A gentle calorie deficit signals "lose some fat"; an extreme one signals "famine \u2014 break down everything, including muscle." Aim to lose around **0.5\u20131% of your body weight per week**. Faster than that and the share of loss coming from muscle climbs.' },
      { type: "p", text: "Set the number with the [Calorie Deficit Calculator](/tools/calorie-deficit-calculator), which warns you if your target pace is too aggressive." },
      { type: "callout", tone: "warning", title: "Crash diets cost muscle", text: "Very aggressive deficits, especially with little protein and no resistance training, are the classic recipe for losing muscle along with fat. Slower is not just safer \u2014 it protects the lean mass that keeps your metabolism up." },
      { type: "h2", text: "Lever 2: Eat enough protein" },
      { type: "p", text: "Protein is the single most important nutrient in a fat-loss phase. A [2016 controlled trial](https://pubmed.ncbi.nlm.nih.gov/26817506/) had participants train hard in a steep deficit; the higher-protein group *gained* a little lean mass while losing fat, and the lower-protein group did not. Aim for roughly **1.6\u20132.4 g/kg of body weight** while dieting \u2014 more than at maintenance." },
      { type: "tool", slug: "protein-intake-calculator", label: "Set your protein target" },
      { type: "p", text: "Then use the [Macro Calculator](/tools/macro-calculator) to fit carbs and fat around that protein for your calorie budget." },
      { type: "h2", text: "Lever 3: Lift to keep the muscle you have" },
      { type: "p", text: "Protein supplies the building blocks, but **resistance training is the signal** that tells your body to hold onto muscle while fat comes off. You do not need to set personal records in a deficit \u2014 you need to keep training hard enough to maintain." },
      { type: "ul", items: [
        "Train each major muscle group about twice a week.",
        "Prioritize compound lifts (squat, hinge, push, pull).",
        "Keep the loads challenging; aim to maintain strength, not chase new maxes.",
        "Track a key lift over time \u2014 the [One-Rep Max Calculator](/tools/one-rep-max-calculator) lets you estimate strength without testing a true max."
      ] },
      { type: "h3", text: "The simple checklist" },
      { type: "ol", items: [
        "Moderate deficit (~0.5\u20131% body weight/week).",
        "High protein (1.6\u20132.4 g/kg).",
        "Resistance training 2\u20134\xD7 per week.",
        "Enough sleep \u2014 under-sleeping shifts loss toward muscle.",
        "Patience: protect the muscle and the fat takes care of itself."
      ] },
      { type: "paa", items: [
        { q: "Can you lose fat and keep muscle at the same time?", a: "Yes. With a moderate calorie deficit, high protein intake, and regular resistance training, most people can lose fat while maintaining \u2014 and beginners can even gain \u2014 muscle." },
        { q: "How do I stop losing muscle when dieting?", a: "Keep your deficit moderate, eat 1.6\u20132.4 g of protein per kg of body weight, lift weights at least twice a week, and sleep enough. Those four together preserve lean mass." },
        { q: "How fast can I lose weight without losing muscle?", a: "Around 0.5\u20131% of your body weight per week is the usual guideline. Faster loss increasingly comes from muscle rather than fat." }
      ] }
    ]
  },
  // 6 ----------------------------------------------------------------------
  {
    slug: "due-date-by-conception-date",
    title: "Due Date by Conception Date: How It Works",
    seoTitle: "Due Date by Conception Date: How It Works",
    metaDescription: "How due dates are calculated from conception, last period (Naegele\u2019s rule), or IVF transfer \u2014 and why your ultrasound date may differ.",
    category: "womens-health",
    excerpt: "Pregnancy is dated in a few different ways, and they do not always agree. Here is how a due date is estimated from conception, your last period, or IVF.",
    author: "HealthyLifeStyles Editorial Team",
    publishDate: "2026-03-20",
    updatedDate: "2026-05-30",
    primaryTool: "due-date-calculator",
    relatedTools: ["due-date-calculator", "ovulation-calculator", "pregnancy-week-calculator"],
    relatedArticles: [],
    sources: [
      { citation: "American College of Obstetricians and Gynecologists (ACOG). Methods for Estimating the Due Date. Committee Opinion 700.", url: "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date" },
      { citation: "Naegele\u2019s rule: LMP + 280 days (40 weeks) is the standard estimate.", url: "https://www.ncbi.nlm.nih.gov/books/NBK459351/" },
      { citation: "ACOG. Ultrasound dating in the first trimester is the most accurate method.", url: "https://www.acog.org/womens-health" }
    ],
    body: [
      { type: "p", text: "A due date is only ever an **estimate** \u2014 fewer than 1 in 20 babies actually arrive on it. But the estimate matters, because it sets the clock for prenatal care. There are a few ways to calculate it, and they start counting from different moments." },
      { type: "h2", text: "The three common methods" },
      { type: "h3", text: "1. From your last menstrual period (Naegele\u2019s rule)" },
      { type: "p", text: 'The traditional method, **Naegele\u2019s rule**, adds 280 days (40 weeks) to the first day of your last menstrual period (LMP). It assumes a regular 28-day cycle with ovulation on day 14, so pregnancy is "counted" from about two weeks before you actually conceived. That is why you can be "4 weeks pregnant" only two weeks after conception.' },
      { type: "h3", text: "2. From conception date" },
      { type: "p", text: "If you know roughly when you conceived \u2014 for example from tracking [ovulation](/tools/ovulation-calculator) \u2014 the estimate is conception date **+ 266 days** (38 weeks), because it skips that pre-ovulation fortnight that the LMP method includes." },
      { type: "h3", text: "3. From an IVF transfer" },
      { type: "p", text: "IVF dates are the most precise, because the embryo\u2019s age is known exactly. A day-5 (blastocyst) transfer is dated as transfer date + 261 days; a day-3 transfer adds 263 days." },
      { type: "tool", slug: "due-date-calculator", label: "Estimate your due date" },
      { type: "callout", tone: "info", title: "Your ultrasound has the final say", text: "According to [ACOG](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date), a first-trimester ultrasound is the most accurate way to date a pregnancy. If your scan date differs from a calculator, your care team will use the scan. Always confirm dates with your OB-GYN or midwife." },
      { type: "h2", text: "Why the methods disagree" },
      { type: "p", text: "The LMP method assumes textbook-regular cycles. If you ovulate earlier or later than day 14, or your cycles run long or short, the LMP estimate can be off by several days \u2014 while the conception-based estimate may be closer. This is exactly why early ultrasound dating exists, and why the number can shift slightly at your first scan." },
      { type: "ul", items: [
        "Track your cycle so you know your real ovulation day with the [Ovulation Calculator](/tools/ovulation-calculator).",
        "Once you have a due date, follow your progress with the [Pregnancy Week-by-Week](/tools/pregnancy-week-calculator) tool.",
        "Treat every date as an estimate and let your clinician confirm it."
      ] },
      { type: "paa", items: [
        { q: "How is a due date calculated from conception?", a: "Add 266 days (38 weeks) to the conception date. This is two weeks less than the last-period method, which counts from before ovulation." },
        { q: "Why is my due date based on my last period, not conception?", a: "Most people know their last period date but not their exact conception date, so the 40-week (LMP + 280 days) method is the practical standard. An early ultrasound then refines it." },
        { q: "How accurate is a due date calculator?", a: "It gives a solid estimate, but a first-trimester ultrasound is more accurate and takes precedence. Only about 1 in 20 babies are born on the estimated date." }
      ] }
    ]
  },
  // 7 ----- Intermittent Fasting -----
  {
    slug: "intermittent-fasting-for-beginners",
    title: "Intermittent Fasting for Beginners: How to Pick a Schedule",
    seoTitle: "Intermittent Fasting for Beginners: Pick a Schedule",
    metaDescription: "Intermittent fasting for beginners: compare 16:8, 18:6, OMAD and 5:2, learn what breaks a fast, and find a schedule you can actually keep.",
    category: "nutrition",
    excerpt: "Cycling between eating and fasting windows \u2014 like 16:8 \u2014 can help you eat less without counting every calorie. Here\u2019s how to pick a schedule you\u2019ll keep.",
    author: "HealthyLifeStyles Editorial Team",
    authorBio: "researches and writes our evidence-based wellness guides, each checked by our medical review team.",
    publishDate: "2026-05-08",
    updatedDate: "2026-06-18",
    primaryTool: "intermittent-fasting-calculator",
    relatedTools: ["intermittent-fasting-calculator", "calorie-calculator", "meal-plan-generator"],
    relatedArticles: ["how-many-calories-to-lose-weight", "how-to-keep-muscle-while-losing-weight"],
    sources: [
      { citation: 'de Cabo R, Mattson MP. "Effects of Intermittent Fasting on Health, Aging, and Disease." N Engl J Med. 2019.', url: "https://pubmed.ncbi.nlm.nih.gov/31881139/" },
      { citation: 'Patterson RE, Sears DD. "Metabolic Effects of Intermittent Fasting." Annu Rev Nutr. 2017.', url: "https://pubmed.ncbi.nlm.nih.gov/28715993/" },
      { citation: 'Harvard T.H. Chan School of Public Health. "Diet Review: Intermittent Fasting for Weight Loss."', url: "https://www.hsph.harvard.edu/nutritionsource/healthy-weight/diet-reviews/intermittent-fasting/" }
    ],
    body: [
      { type: "p", text: "Intermittent fasting means cycling between set eating and fasting windows instead of changing what you eat. The most popular schedule, 16:8, has you eat within an 8-hour window and fast for 16. For some people it curbs snacking and steadies energy \u2014 but the best schedule is simply the one you can stick to." },
      { type: "h2", text: "What is intermittent fasting, exactly?" },
      { type: "p", text: "Most diets tell you **what** to eat. Intermittent fasting (IF) is about **when**. You pick a daily eating window \u2014 say noon to 8 p.m. \u2014 and eat all your food within it, fasting the rest of the day. Your overnight sleep does most of the work, so a 16-hour fast is gentler than it sounds." },
      { type: "p", text: 'There\u2019s no magic switch. IF mostly works by quietly shrinking the hours in which you eat, which for many people means fewer total calories without tracking. The popular claims about autophagy and "metabolic switching" come largely from animal and early human studies \u2014 promising, but not a guarantee you\u2019ll get those effects.' },
      { type: "h2", text: "Which fasting schedule should a beginner pick?" },
      { type: "p", text: "Start gentle, and only tighten the window if it feels easy. Here\u2019s how the common protocols compare:" },
      { type: "table", headers: ["Schedule", "Fast / eat", "Best for", "Difficulty"], rows: [
        ["14:10", "14h fast / 10h eat", "First-timers", "Easy"],
        ["16:8", "16h fast / 8h eat", "The popular default", "Moderate"],
        ["18:6", "18h fast / 6h eat", "Experienced fasters", "Harder"],
        ["OMAD", "~23h fast / one meal", "Simplicity seekers", "Hard"],
        ["5:2", "2 low-calorie days a week", "People who hate daily limits", "Moderate"]
      ] },
      { type: "p", text: "New to this? Try 14:10 for a week or two, then move to 16:8. Enter your wake time and window below to see your exact eating and fasting hours with a live countdown:" },
      { type: "tool", slug: "intermittent-fasting-calculator", label: "Try it: Intermittent Fasting Calculator" },
      { type: "h2", text: "What can you eat or drink while fasting?" },
      { type: "p", text: "During the fast, anything with calories restarts the clock. These keep you in the fasted state:" },
      { type: "ul", items: [
        "Water and sparkling water",
        "Black coffee \u2014 no milk, sugar, or cream",
        "Plain tea",
        "A pinch of salt or electrolytes if you feel light-headed"
      ] },
      { type: "p", text: "A splash of milk in your coffee is the most common slip \u2014 small, but it adds calories and ends the fast. In your eating window, build meals around protein and whole foods; see [how much protein you really need](/wellness-hub/how-much-protein-do-i-need) to hold onto muscle." },
      { type: "h2", text: "Does intermittent fasting actually help you lose weight?" },
      { type: "p", text: "It can \u2014 but not because of the clock itself. Reviews comparing IF with steady calorie cutting find similar weight loss when calories match. IF just makes the cutting easier for people who\u2019d rather not track. If your eating window turns into a free-for-all, the deficit disappears. Pair it with a sensible target from the [Calorie Calculator](/tools/calorie-calculator) and read [how many calories to eat to lose weight](/wellness-hub/how-many-calories-to-lose-weight)." },
      { type: "callout", tone: "warning", title: "Not for everyone", text: "Skip intermittent fasting if you\u2019re pregnant or breastfeeding, under 18, have a history of disordered eating, or take medication for diabetes or blood pressure that depends on meal timing. Talk to your doctor first." },
      { type: "h2", text: "How long before you see results?" },
      { type: "p", text: "Most people need 2\u20134 weeks to settle into a window without watching the clock, and visible changes usually follow a consistent deficit over 6\u201312 weeks. Early scale drops are mostly water \u2014 judge progress over months, not days." },
      { type: "paa", items: [
        { q: "Is 16:8 better than 18:6?", a: "Not inherently. 16:8 is easier to sustain, and a schedule you keep beats a stricter one you abandon. Only tighten the window if 16:8 feels effortless." },
        { q: "Will I lose muscle if I fast?", a: "You can if protein and resistance training are low. Hit your protein target and lift a few times a week and most of what you lose is fat \u2014 the [Muscle Preservation Calculator](/tools/muscle-preservation-calculator) can check your risk." },
        { q: "Does coffee break a fast?", a: "Black coffee, plain tea, and water are fine. Milk, sugar, cream, or anything with calories breaks it." },
        { q: "Does fasting wreck your metabolism?", a: 'Short daily fasts don\u2019t "starve" your metabolism. Very aggressive, prolonged restriction can lower energy expenditure over time, which is one reason a moderate approach wins.' },
        { q: "Can I exercise while fasting?", a: "Yes \u2014 many people train fasted comfortably. If you feel weak or light-headed, move harder workouts into your eating window." }
      ] }
    ]
  },
  // 8 ----- Sleep Chronotypes -----
  {
    slug: "sleep-chronotypes-explained",
    title: "Sleep Chronotypes: Are You a Lion, Bear, Wolf, or Dolphin?",
    seoTitle: "Sleep Chronotypes: Lion, Bear, Wolf or Dolphin?",
    metaDescription: "Lion, Bear, Wolf, or Dolphin? Learn the four sleep chronotypes, how to find yours, and how to schedule sleep and focus around your body clock.",
    category: "sleep",
    excerpt: "Lion, Bear, Wolf, or Dolphin? Your chronotype is your body\u2019s natural timing \u2014 and matching your day to it makes sleep and focus easier.",
    author: "HealthyLifeStyles Editorial Team",
    authorBio: "researches and writes our evidence-based wellness guides, each checked by our medical review team.",
    publishDate: "2026-05-15",
    updatedDate: "2026-06-19",
    primaryTool: "sleep-chronotype-quiz",
    relatedTools: ["sleep-chronotype-quiz", "sleep-calculator", "caffeine-curfew-calculator"],
    relatedArticles: ["best-time-to-stop-drinking-coffee-for-sleep"],
    sources: [
      { citation: 'Roenneberg T, et al. "Life between clocks: daily temporal patterns of human chronotypes." J Biol Rhythms. 2003.', url: "https://pubmed.ncbi.nlm.nih.gov/?term=Life+between+clocks+daily+temporal+patterns+human+chronotypes+Roenneberg" },
      { citation: 'Sleep Foundation. "Chronotypes: Definition, Types, & Effects."', url: "https://www.sleepfoundation.org/how-sleep-works/chronotypes" },
      { citation: 'Blume C, Garbazza C, Spitschan M. "Effects of light on human circadian rhythms, sleep and mood." Somnologie. 2019.', url: "https://pubmed.ncbi.nlm.nih.gov/31534436/" }
    ],
    body: [
      { type: "p", text: "Your chronotype is your body\u2019s natural timing for sleep and peak energy. The popular framework sorts people into four animals \u2014 Lion (early bird), Bear (in sync with the sun, and most common), Wolf (night owl), and Dolphin (light, restless sleeper). Knowing yours lets you schedule sleep, deep work, and exercise with your clock instead of fighting it." },
      { type: "h2", text: "What is a sleep chronotype?" },
      { type: "p", text: "A chronotype is your inherited lean toward mornings or evenings, set by your internal body clock. It\u2019s why some people bound out of bed at 6 a.m. while others hit their stride at 10 p.m. It\u2019s largely genetic and shifts predictably with age \u2014 but you have some room to nudge it." },
      { type: "h2", text: "What are the four chronotypes?" },
      { type: "p", text: "Sleep researchers often describe four patterns. Most people are Bears; true Lions and Wolves are smaller groups; Dolphins are the lightest sleepers." },
      { type: "table", caption: "Approximate shares vary by study \u2014 treat them as rough guides.", headers: ["Chronotype", "Natural wake", "Peak focus", "Roughly % of people"], rows: [
        ["\u{1F981} Lion", "5\u20136 a.m.", "Early morning", "~15%"],
        ["\u{1F43B} Bear", "7 a.m.", "Mid-morning to noon", "~50%"],
        ["\u{1F43A} Wolf", "9 a.m. or later", "Late afternoon & evening", "~15%"],
        ["\u{1F42C} Dolphin", "Restless, varies", "Late morning", "~10%"]
      ] },
      { type: "p", text: "Not sure which fits? The quiz takes about a minute and gives you an ideal daily schedule:" },
      { type: "tool", slug: "sleep-chronotype-quiz", label: "Try it: Sleep Chronotype Quiz" },
      { type: "h2", text: "Can you change your chronotype?" },
      { type: "p", text: "You can\u2019t turn a Wolf into a Lion, but you can shift your clock by an hour or two. Morning daylight pulls you earlier; bright evening light and late screens push you later. Age moves it for you: children skew early, teens biologically skew late (which is why early school start times hurt them), and most people drift earlier again after 60." },
      { type: "h2", text: "How do I use my chronotype day to day?" },
      { type: "ol", items: [
        "Anchor a consistent wake time \u2014 the single biggest lever.",
        "Get outdoor light within an hour of waking to set your clock.",
        "Schedule your hardest thinking for your peak-focus window.",
        'Exercise when your body is most willing, not when you "should".',
        "Dim screens 1\u20132 hours before your natural bedtime \u2014 see [when to stop drinking coffee for sleep](/wellness-hub/best-time-to-stop-drinking-coffee-for-sleep)."
      ] },
      { type: "p", text: 'One trap: treating your chronotype as a free pass. A Wolf who scrolls until 2 a.m. on weekends builds "social jet lag" \u2014 a gap between body clock and schedule that leaves you groggy all week. Knowing your type helps you plan around it, not skip good sleep habits.' },
      { type: "callout", tone: "tip", title: "Time your caffeine", text: "Whatever your type, caffeine has a roughly 5-hour half-life. Find your personal cut-off with the [Caffeine Curfew Calculator](/tools/caffeine-curfew-calculator)." },
      { type: "paa", items: [
        { q: "What is the rarest chronotype?", a: "Dolphins and true Lions are the smaller groups (each roughly 10\u201315% of people); Bears are the majority." },
        { q: "Is being a night owl unhealthy?", a: "Not on its own. Problems usually come from forcing a late clock into an early schedule, which shortens sleep. Protecting enough total sleep matters more than the timing." },
        { q: "What\u2019s the difference between a chronotype and a circadian rhythm?", a: "Your circadian rhythm is the ~24-hour clock everyone has; your chronotype is where that clock naturally sits \u2014 earlier or later than average." },
        { q: "Can I become a morning person?", a: "You can shift earlier with consistent wake times and morning light, but you\u2019ll likely stay near your natural type. Work with it where you can." },
        { q: "What chronotype is most common?", a: "The Bear \u2014 about half of people. Bears wake and sleep roughly with the sun and do well on a standard 9-to-5." }
      ] }
    ]
  },
  // 9 ----- Meal Plan -----
  {
    slug: "how-to-build-a-meal-plan",
    title: "How to Build a High-Protein Meal Plan You\u2019ll Actually Follow",
    seoTitle: "How to Build a High-Protein Meal Plan (Free)",
    metaDescription: "Build a meal plan that works: set calories, lock in protein, and keep it flexible. A simple 5-step framework, a sample day, and a free generator.",
    category: "nutrition",
    excerpt: "A good meal plan starts with calories, locks in protein, and stays flexible enough to actually follow. Here\u2019s the framework \u2014 plus a free generator.",
    author: "HealthyLifeStyles Editorial Team",
    authorBio: "researches and writes our evidence-based wellness guides, each checked by our medical review team.",
    publishDate: "2026-05-22",
    updatedDate: "2026-06-17",
    primaryTool: "meal-plan-generator",
    relatedTools: ["meal-plan-generator", "macro-calculator", "protein-intake-calculator"],
    relatedArticles: ["how-much-protein-do-i-need", "how-many-calories-to-lose-weight"],
    sources: [
      { citation: 'J\xE4ger R, et al. "ISSN Position Stand: protein and exercise." J Int Soc Sports Nutr. 2017.', url: "https://pubmed.ncbi.nlm.nih.gov/28642676/" },
      { citation: 'U.S. Department of Agriculture & HHS. "Dietary Guidelines for Americans, 2020\u20132025."', url: "https://www.dietaryguidelines.gov/" },
      { citation: 'Academy of Nutrition and Dietetics. "How to Build a Healthy Eating Routine."', url: "https://www.eatright.org/" }
    ],
    body: [
      { type: "p", text: "A solid meal plan starts with your daily calorie target, then locks in protein \u2014 about 1.6\u20132.2 grams per kilogram of body weight if you\u2019re active \u2014 and fills the rest with carbs and fats you enjoy. Spread protein across three or four meals, plan around foods you\u2019ll actually eat, and leave a little room for flexibility." },
      { type: "h2", text: "How do you build a meal plan from scratch?" },
      { type: "p", text: "You don\u2019t need an app or a dietitian to start. Five steps cover it:" },
      { type: "ol", items: [
        "Set your calories \u2014 use the [Calorie Calculator](/tools/calorie-calculator) for maintenance, then subtract a modest deficit if you\u2019re losing.",
        "Lock in protein \u2014 aim for 1.6\u20132.2 g/kg; the [Protein Intake Calculator](/tools/protein-intake-calculator) gives your number.",
        "Split the day \u2014 a common split is 25% breakfast, 35% lunch, 30% dinner, 10% snack.",
        "Pick foods you like for each slot, hitting protein at every meal.",
        "Build a grocery list and prep what you can ahead of time."
      ] },
      { type: "p", text: "Prefer to skip the math? The generator does all five steps from your targets and diet style:" },
      { type: "tool", slug: "meal-plan-generator", label: "Try it: 7-Day Meal Plan Generator" },
      { type: "h2", text: "How much protein should each meal have?" },
      { type: "p", text: 'Muscle responds best to protein spread out rather than dumped into one meal. Aim for roughly 0.4 g per kg of body weight per meal \u2014 about 25\u201340 g for most people \u2014 enough to cross the "leucine threshold" that triggers muscle repair. Here\u2019s how a high-protein day around 2,000 calories can look:' },
      { type: "table", caption: "A sample 2,000 kcal day with about 145 g of protein.", headers: ["Meal", "Example", "Calories", "Protein"], rows: [
        ["Breakfast", "Greek yogurt, berries, oats", "~450", "35 g"],
        ["Lunch", "Chicken, rice, vegetables", "~650", "45 g"],
        ["Dinner", "Salmon, potatoes, salad", "~600", "40 g"],
        ["Snack", "Cottage cheese & fruit", "~300", "25 g"]
      ] },
      { type: "h2", text: "How do you make a meal plan you\u2019ll actually stick to?" },
      { type: "ul", items: [
        "Repeat breakfasts and snacks \u2014 save the variety for lunch and dinner.",
        "Batch-cook proteins and grains once or twice a week.",
        "Leave 10\u201315% of calories for treats so the plan survives real life.",
        "Shop from your list to avoid impulse buys."
      ] },
      { type: "p", text: 'The best plan is rarely the "optimal" one. Near-perfect adherence to a slightly imperfect plan beats perfect macros you abandon by Wednesday. Build for your real schedule, not an ideal one.' },
      { type: "callout", tone: "tip", title: "Protein on a budget", text: "Eggs, canned tuna, lentils, Greek yogurt, and frozen chicken are cheap, high-protein staples that make any plan easier to hit." },
      { type: "h2", text: "Should you plan differently for weight loss or muscle gain?" },
      { type: "p", text: "The structure is identical; only the calorie target moves. For fat loss, eat below maintenance and keep protein high to protect muscle \u2014 see [how to keep muscle while losing weight](/wellness-hub/how-to-keep-muscle-while-losing-weight). For muscle gain, eat a slight surplus. The [Macro Calculator](/tools/macro-calculator) sets carbs and fat around your protein either way." },
      { type: "paa", items: [
        { q: "How many meals a day should I eat to lose weight?", a: "Total calories matter far more than meal count. Three to four meals suits most people \u2014 choose the number that keeps you full and consistent." },
        { q: "Is meal prep worth it?", a: "For most people, yes. Prepping even one or two components (a protein and a grain) removes daily decisions and makes hitting your targets far easier." },
        { q: "How do I hit my protein target?", a: "Anchor every meal with a protein source, use Greek yogurt or a shake to close gaps, and read labels by grams of protein per serving." },
        { q: "Can I eat the same meals every day?", a: "Yes. Repetition makes planning and shopping easier \u2014 just cover protein, plenty of vegetables, and enough variety to stay interested." },
        { q: "Do I have to count calories forever?", a: "No. Most people track for a few weeks to learn portion sizes, then maintain with awareness rather than weighing everything." }
      ] }
    ]
  },
  // 10 ----- Weight Loss Timeline -----
  {
    slug: "how-long-does-it-take-to-lose-weight",
    title: "How Long Does It Take to Lose Weight? A Realistic Timeline",
    seoTitle: "How Long Does It Take to Lose Weight?",
    metaDescription: "A realistic weight-loss timeline by goal (10, 20, 50 lb), why the scale stalls, and how to keep it off \u2014 at a safe, sustainable pace.",
    category: "weight-loss",
    excerpt: "Safe weight loss takes longer than reality TV suggests. Here\u2019s a realistic timeline by goal \u2014 and why the scale stalls partway through.",
    author: "HealthyLifeStyles Editorial Team",
    authorBio: "researches and writes our evidence-based wellness guides, each checked by our medical review team.",
    publishDate: "2026-05-29",
    updatedDate: "2026-06-20",
    primaryTool: "weight-loss-timeline-calculator",
    relatedTools: ["weight-loss-timeline-calculator", "calorie-deficit-calculator", "calorie-calculator"],
    relatedArticles: ["how-many-calories-to-lose-weight", "how-to-keep-muscle-while-losing-weight"],
    sources: [
      { citation: 'Centers for Disease Control and Prevention (CDC). "Losing Weight" \u2014 about 1 to 2 pounds per week.', url: "https://www.cdc.gov/healthyweight/losing_weight/index.html" },
      { citation: 'Hall KD, et al. "Metabolic adaptation to weight loss." Obesity / energy-balance research.', url: "https://pubmed.ncbi.nlm.nih.gov/26399868/" },
      { citation: "National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK). Body Weight Planner.", url: "https://www.niddk.nih.gov/bwp" }
    ],
    body: [
      { type: "p", text: "At a safe, sustainable pace of about 0.5\u20131 kg (1\u20132 lb) a week, losing 5 kg takes roughly 5\u201310 weeks and 10 kg about 10\u201320 weeks. Your exact timeline depends on your starting weight and how large a calorie deficit you can hold without losing muscle or burning out." },
      { type: "h2", text: "How fast can you safely lose weight?" },
      { type: "p", text: "The CDC and most clinicians point to 1\u20132 pounds (about 0.5\u20131 kg) a week as the sweet spot \u2014 roughly up to 1% of your body weight. Heavier people can safely lose a little faster at first; lighter people should expect slower. Going faster usually means shedding muscle and water rather than fat, and it\u2019s far harder to sustain." },
      { type: "h2", text: "How long will it take to lose 10, 20, or 50 pounds?" },
      { type: "p", text: "At a steady pace the arithmetic is simple. These ranges assume a consistent deficit:" },
      { type: "table", headers: ["Goal", "At ~1 lb/week", "At ~2 lb/week"], rows: [
        ["10 lb (4.5 kg)", "~10 weeks", "~5 weeks"],
        ["20 lb (9 kg)", "~20 weeks (5 months)", "~10 weeks"],
        ["30 lb (14 kg)", "~30 weeks (7 months)", "~15 weeks"],
        ["50 lb (23 kg)", "~50 weeks (1 year)", "~25 weeks"]
      ] },
      { type: "p", text: "See your own projected date and a week-by-week chart \u2014 at a pace the tool keeps safe:" },
      { type: "tool", slug: "weight-loss-timeline-calculator", label: "Try it: Weight Loss Timeline Calculator" },
      { type: "h2", text: "Why does weight loss slow down over time?" },
      { type: "p", text: 'Two reasons. First, a lighter body burns fewer calories, so the deficit that worked at the start shrinks \u2014 a real effect called metabolic adaptation. Second, and most misunderstood: the dramatic drop in week one is mostly water and glycogen, not fat. When the scale "stalls" around week three, fat loss is often still happening \u2014 you\u2019ve just stopped shedding water.' },
      { type: "callout", tone: "tip", title: "Re-check your numbers", text: "Every few weeks, recalculate your target as you get lighter. The [Calorie Deficit Calculator](/tools/calorie-deficit-calculator) shows the daily deficit your new weight needs." },
      { type: "h2", text: "How do you keep the weight off?" },
      { type: "ul", items: [
        "Lose at a pace you can imagine living with \u2014 habits, not heroics.",
        "Keep protein high and strength-train to protect muscle and metabolism.",
        "Plan a maintenance phase; staying at weight is a skill, not a finish line.",
        "Track the trend over weeks, not daily fluctuations."
      ] },
      { type: "p", text: "The biggest predictor of keeping weight off isn\u2019t how fast you lost it \u2014 it\u2019s whether the way you lost it is something you can continue. That\u2019s why slow usually wins. For the calorie side, start with [how many calories to eat to lose weight](/wellness-hub/how-many-calories-to-lose-weight)." },
      { type: "paa", items: [
        { q: "Is losing 2 lb a week realistic?", a: "For heavier people, yes \u2014 at least early on. As you get lighter it becomes harder and more likely to cost muscle, so many people settle around 1 lb a week." },
        { q: "Why did my weight loss stall?", a: "Usually a shrinking deficit as you get lighter, water-weight swings masking fat loss, or portions creeping up. Recalculate your target, tighten tracking for two weeks, and look at the monthly trend." },
        { q: "How much weight can you lose in a month safely?", a: "About 4\u20138 lb (2\u20134 kg) for most people, at 1\u20132 lb a week. Faster than that is usually water and muscle, not fat." },
        { q: "Does losing weight slowly help you keep it off?", a: "It tends to, mainly because a slower pace is built on habits you can sustain. The method that fits your life is the one that lasts." },
        { q: "How long does it take to lose 20 pounds?", a: "Roughly 10 weeks at 2 lb a week or 20 weeks at 1 lb a week, depending on how consistent your deficit is." }
      ] }
    ]
  },
  // Macros ------------------------------------------------------------------
  {
    slug: "how-to-calculate-your-macros",
    title: "How to Calculate Your Macros for Your Goal",
    seoTitle: "How to Calculate Your Macros for Your Goal",
    metaDescription: "Calculate your macros in three steps: set protein by body weight, add fat, then fill the rest with carbs \u2014 for fat loss, maintenance or muscle gain.",
    category: "nutrition",
    excerpt: "Calories decide whether your weight changes; macros decide what that weight is \u2014 fat or muscle. Here\u2019s how to set your protein, carbs, and fat for your goal, and adjust them as you go.",
    author: "HealthyLifeStyles Editorial Team",
    authorBio: "researches and writes our evidence-based wellness guides, each checked by our medical review team.",
    publishDate: "2026-06-23",
    updatedDate: "2026-06-23",
    primaryTool: "macro-calculator",
    relatedTools: ["macro-calculator", "calorie-calculator", "protein-intake-calculator", "meal-plan-generator"],
    relatedArticles: ["how-much-protein-do-i-need", "how-many-calories-to-lose-weight", "how-to-build-a-meal-plan"],
    sources: [
      { citation: "J\xE4ger R, et al. ISSN Position Stand: Protein and Exercise. J Int Soc Sports Nutr. 2017.", url: "https://pubmed.ncbi.nlm.nih.gov/28642676/" },
      { citation: "U.S. Department of Agriculture & HHS. Dietary Guidelines for Americans, 2020\u20132025 (Acceptable Macronutrient Distribution Ranges).", url: "https://www.dietaryguidelines.gov/" },
      { citation: "Morton RW, et al. A systematic review of protein supplementation and resistance-training adaptations. Br J Sports Med. 2018.", url: "https://pubmed.ncbi.nlm.nih.gov/28698222/" }
    ],
    body: [
      { type: "p", text: "To calculate your macros, start from your daily calorie target, then split it in three steps: set **protein** first at about 1.6\u20132.2 g per kilogram of body weight, add **fat** at roughly 0.8\u20131 g per kg, and fill the rest with **carbs**. Protein and carbs have 4 calories per gram; fat has 9." },
      { type: "p", text: "That order matters. Protein protects muscle and keeps you full, fat covers your hormones and a lot of flavour, and carbs are the flexible fuel you adjust to fit your calories. Get protein and total calories right, and the exact carb-to-fat split is mostly down to preference." },
      { type: "h2", text: "What are macros, exactly?" },
      { type: "p", text: "**Macros** \u2014 short for macronutrients \u2014 are the three nutrients your body needs in large amounts: protein, carbohydrate, and fat. Each supplies energy. Protein and carbohydrate give about 4 calories per gram; fat gives about 9. (Alcohol, at 7 calories per gram, is a fourth energy source, but it isn\u2019t a nutrient you build a plan around.)" },
      { type: "p", text: "Your macro targets are just your calorie target divided into those three buckets. So macros never override calories \u2014 they organise them." },
      { type: "h2", text: "How to calculate your macros, step by step" },
      { type: "p", text: "This is the protein-first method most evidence-based coaches use:" },
      { type: "ol", items: [
        "**Find your calories.** Start from your maintenance calories (TDEE), then subtract for fat loss or add for muscle gain. Not sure of the number? Use the [Calorie Calculator](/tools/calorie-calculator) first.",
        "**Set protein.** Aim for 1.6\u20132.2 g per kg of body weight (about 0.7\u20131 g per pound), toward the higher end when you\u2019re in a deficit or training hard. Multiply your grams by 4 for protein calories.",
        "**Set fat.** Use 0.8\u20131 g per kg (roughly 20\u201335% of calories). Dropping much lower can hit your hormones and leave you hungry. Multiply by 9 for fat calories.",
        "**Fill the rest with carbs.** Subtract your protein and fat calories from your total, then divide what\u2019s left by 4. Those are your carb grams \u2014 your training fuel."
      ] },
      { type: "p", text: "Worked example: a 70 kg (154 lb) person eating 2,000 calories might land on roughly 140 g protein (560 cal), 60 g fat (540 cal), and 225 g carbs (900 cal). A calculator does this instantly, but running it by hand once shows you why the numbers move the way they do." },
      { type: "tool", slug: "macro-calculator", label: "Try it: Macro Calculator" },
      { type: "h2", text: "Do macros matter more than calories?" },
      { type: "p", text: "No \u2014 calories decide whether your weight goes up or down; macros decide what that weight is and how the diet feels. You can lose fat on almost any split as long as you\u2019re in a calorie deficit. But hit a high-protein target and you\u2019ll keep more muscle, feel fuller, and recover better than on the same calories with low protein." },
      { type: "callout", tone: "tip", title: "The detail most macro guides miss", text: "Set protein in **grams from your body weight**, not as a percentage of calories. \u201C30% protein\u201D sounds fixed, but 30% of 2,500 calories and 30% of 1,500 are very different amounts \u2014 so as you diet and eat less, a percentage quietly shrinks your protein right when you need it most. Grams per kilogram stays honest." },
      { type: "h2", text: "What\u2019s the best macro ratio to lose fat?" },
      { type: "p", text: "There isn\u2019t one magic ratio. Once protein and calories are set, the leftover energy can lean toward carbs or fat based on what suits you \u2014 active people and heavier trainers usually feel better with more carbs, others prefer more fat. A balanced fat-loss starting point is roughly 40% carbs / 30% protein / 30% fat, but treat that as a starting line, not a rule." },
      { type: "table", caption: "Set protein and fat in grams per kilogram of body weight; carbohydrate fills the remaining calories.", headers: ["Goal", "Calories", "Protein", "Fat", "Carbs"], rows: [
        ["Fat loss (cut)", "TDEE \u2212 15\u201320%", "2.0\u20132.2 g/kg", "0.8\u20131 g/kg", "Remaining"],
        ["Maintenance", "\u2248 TDEE", "1.6\u20131.8 g/kg", "~1 g/kg", "Remaining"],
        ["Muscle gain (bulk)", "TDEE + 5\u201310%", "1.6\u20132.0 g/kg", "~1 g/kg", "Remaining"]
      ] },
      { type: "h2", text: "How much protein do you need per day?" },
      { type: "p", text: "For most active adults, 1.6\u20132.2 g per kg of body weight a day covers muscle maintenance and growth, with the upper end helping while you diet. For a 70 kg (154 lb) person that\u2019s about 112\u2013154 g daily, spread over 3\u20134 meals of 20\u201340 g. For the full picture \u2014 including older adults and plant-based eaters \u2014 see [how much protein you really need](/wellness-hub/how-much-protein-do-i-need)." },
      { type: "h2", text: "How to adjust your macros as you progress" },
      { type: "p", text: "Macros aren\u2019t set once. Recalculate when the scale moves meaningfully \u2014 about every 4\u20136 kg (10 lb) of change, or whenever progress stalls for two to three weeks." },
      { type: "ul", items: [
        "**Lost weight?** Bring calories and carbs down a little; keep protein in grams roughly the same \u2014 it\u2019s tied to your new body weight, so it barely changes.",
        "**Stalled in a cut?** Trim carbs or add daily steps before touching protein or fat \u2014 those two protect muscle and keep you full.",
        "**Gaining too fast on a bulk?** Pull carbs back first. You want to add muscle, not just weight.",
        "**Energy in the gym tanking?** Shift some calories from fat to carbs at the same total \u2014 carbs fuel hard training."
      ] },
      { type: "p", text: "Then turn the numbers into food. The [7-Day Meal Plan Generator](/tools/meal-plan-generator) builds a week of meals around your targets, with a grocery list." },
      { type: "paa", items: [
        { q: "How do I calculate my macros for weight loss?", a: "Set calories below maintenance (a deficit of about 15\u201320% works well), keep protein high at 2.0\u20132.2 g per kg of body weight, set fat around 0.8\u20131 g per kg, and fill the rest with carbs. The deficit drives fat loss; the high protein protects your muscle." },
        { q: "Is counting macros better than counting calories?", a: "Counting calories alone is enough to change your weight. Counting macros adds control over body composition and how full you feel, because it guarantees you hit protein. Many people count calories and protein only, and let carbs and fat fall where they like." },
        { q: "What macro split should I start with?", a: "A balanced starting point is roughly 30% protein, 30% fat, 40% carbs \u2014 then adjust. But set protein and fat in grams per kilogram first and let carbs fill the rest; the percentages are the result, not the goal." },
        { q: "Do I need to hit my macros exactly every day?", a: "No. Aim to land within about 5\u201310 g of your protein and calorie targets most days. Carbs and fat can flex day to day \u2014 weekly consistency matters more than daily perfection." },
        { q: "How many grams of protein, carbs, and fat should I eat?", a: "It depends on your weight and calories, but a common example for a 70 kg adult eating 2,000 calories is about 140 g protein, 225 g carbs, and 60 g fat. Calculate your own with the macro calculator above." }
      ] },
      { type: "p", text: "Get your calories and protein right, set fat sensibly, let carbs fill the gap \u2014 then recheck the numbers as your body changes. That\u2019s the whole skill." }
    ]
  }
];
var ARTICLES_PER_PAGE = 9;
var getArticle = (slug) => ARTICLES.find((a) => a.slug === slug);
var getArticleCategory = (id) => ARTICLE_CATEGORIES.find((c) => c.id === id || c.slug === id);
var byNewest = (a, b) => (b.updatedDate || b.publishDate).localeCompare(a.updatedDate || a.publishDate);
var getArticlesByCategory = (categoryId) => ARTICLES.filter((a) => a.category === categoryId).sort(byNewest);
var countArticlesByCategory = (categoryId) => ARTICLES.filter((a) => a.category === categoryId).length;
var getFeaturedArticle = () => ARTICLES.find((a) => a.featured) ?? [...ARTICLES].sort(byNewest)[0];
var getLatestArticles = (limit = 6, excludeSlug) => [...ARTICLES].sort(byNewest).filter((a) => a.slug !== excludeSlug).slice(0, limit);
var getRelatedArticles = (slug, limit = 3) => {
  const article = getArticle(slug);
  if (!article) return [];
  const out = [];
  const push = (a) => {
    if (a && a.slug !== slug && !out.includes(a)) out.push(a);
  };
  (article.relatedArticles ?? []).forEach((s) => push(getArticle(s)));
  getArticlesByCategory(article.category).forEach(push);
  getLatestArticles(ARTICLES.length).forEach(push);
  return out.slice(0, limit);
};
var getArticlesForTool = (toolSlug, limit = 3) => ARTICLES.filter((a) => a.primaryTool === toolSlug || a.relatedTools.includes(toolSlug)).sort(byNewest).slice(0, limit);
var articlePlainText = (article) => {
  const parts = [article.title, article.excerpt];
  for (const b of article.body) {
    if (b.type === "p" || b.type === "h2" || b.type === "h3") parts.push(stripInline(b.text));
    else if (b.type === "callout") parts.push(stripInline(b.text));
    else if (b.type === "ul" || b.type === "ol") parts.push(...b.items.map(stripInline));
    else if (b.type === "table") parts.push(...b.headers, ...b.rows.flat().map(stripInline));
    else if (b.type === "paa") parts.push(...b.items.flatMap((i) => [i.q, i.a]));
  }
  return parts.join(" ");
};
var articleFaq = (article) => article.body.filter((b) => b.type === "paa").flatMap((b) => b.items);
var ARTICLE_REVIEW = {
  reviewer: EDITORIAL.reviewerName,
  credential: EDITORIAL.reviewerCredential,
  lastReviewed: EDITORIAL.lastReviewed
};

// .astro-entry.mjs
var consts = consts_exports;
var authors = authors_exports;
var categories = categories_exports;
var tools = tools_exports;
var articles = articles_exports;
export {
  articles,
  authors,
  categories,
  consts,
  tools
};

// Static UI fixture for the read-only "Sub-categories across users" demo
// table in the admin categories page. Extracted from src/lib/mock-data.js
// during Phase J cleanup.
//
// ⚠ These are NOT real data. The actual category CRUD uses `listCategories`
// from `src/lib/queries/admin-categories.js`. This fixture only feeds the
// visual expanded-row demo content on the admin categories page — it should
// be removed once the backend ships a cross-user sub-category aggregation
// endpoint (see backend gap tracking).

export const SUB_CATEGORY_FIXTURES = [
  { value: 'sub-kitchen-groceries',  label: 'Groceries',         parentId: 'cat-kitchen' },
  { value: 'sub-kitchen-utensils',   label: 'Utensils',          parentId: 'cat-kitchen' },
  { value: 'sub-kitchen-cleaning',   label: 'Cleaning supplies', parentId: 'cat-kitchen' },
  { value: 'sub-travel-fuel',        label: 'Fuel',              parentId: 'cat-travel' },
  { value: 'sub-travel-uber',        label: 'Uber',              parentId: 'cat-travel' },
  { value: 'sub-travel-bus',         label: 'Bus tickets',       parentId: 'cat-travel' },
  { value: 'sub-food-lunch',         label: 'Team lunch',        parentId: 'cat-food' },
  { value: 'sub-food-snacks',        label: 'Office snacks',     parentId: 'cat-food' },
  { value: 'sub-donation-friday',    label: 'Friday donations',  parentId: 'cat-donation' },
  { value: 'sub-utilities-elec',     label: 'Electricity',       parentId: 'cat-utilities' },
]
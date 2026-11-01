import { describe, expect, it } from 'vitest';
import { assertIsolatedStagingDatabase as guard } from './isolated-staging-database';

const good = {
 databaseUri: 'postgresql://test:password@ep-stage.us-east-1.aws.neon.tech/neondb',
 stagingHost: 'ep-stage.us-east-1.aws.neon.tech',
 productionHost: 'ep-live.us-east-1.aws.neon.tech',
};
describe('staging database fail-closed startup', () => {
 it('accepts independently declared distinct endpoints', () => {
  expect(() => guard(good)).not.toThrow();
 });
 it('rejects live endpoint, pooler aliases, missing declarations and mismatches', () => {
  for(const data of [
   { ...good, databaseUri: 'postgresql://test:password@ep-live.us-east-1.aws.neon.tech/neondb' },
   { ...good, databaseUri: 'postgresql://test:password@ep-live-pooler.us-east-1.aws.neon.tech/neondb',
     stagingHost: 'ep-live-pooler.us-east-1.aws.neon.tech' },
   { ...good, stagingHost: undefined },
   { ...good, productionHost: undefined },
   { ...good, stagingHost: good.productionHost },
   { ...good, databaseUri: 'postgresql://test:password@ep-other.us-east-1.aws.neon.tech/neondb' },
   { ...good, stagingHost: 'https://ep-stage.us-east-1.aws.neon.tech' },
  ]) expect(() => guard(data)).toThrow(/refused/);
 });
 it('allows ONLY exact CI mock URI under explicitly gated CI runtime', () => {
  expect(() => guard({databaseUri:'postgres://mock:mock@localhost:5432/mock',ciMockRuntime:true})).not.toThrow();
  expect(() => guard({databaseUri:'postgres://mock:mock@localhost:5432/other',ciMockRuntime:true})).toThrow();
 });
});

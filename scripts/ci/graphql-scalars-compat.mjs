/**
 * CI-only runtime compatibility smoke test for the patched graphql-scalars.
 * This deliberately runs under native Node (not Vitest/Vite's module loader),
 * in BOTH ESM and CommonJS modes. No CMS data, server, network or secrets.
 *
 * graphql-js validates GraphQLScalarType by module identity. A bundler can
 * load different realms and create false incompatibility errors. Neither
 * successful mode proves the hosted Payload HTTP GraphQL route end-to-end.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esmGraphQL from 'graphql';
import * as esmScalars from 'graphql-scalars';

const require = createRequire(import.meta.url);
const combinations = [
  { label: 'native ESM import', gql: esmGraphQL, scalars: esmScalars },
  { label: 'native CommonJS require', gql: require('graphql'), scalars: require('graphql-scalars') },
];

for (const { label, gql, scalars } of combinations) {
  assert.equal(scalars.DateTimeResolver.name, 'DateTime', label);
  assert.equal(scalars.EmailAddressResolver.name, 'EmailAddress', label);

  const schema = new gql.GraphQLSchema({
    query: new gql.GraphQLObjectType({
      name: 'SmokeQuery',
      fields: {
        date: {
          type: scalars.DateTimeResolver,
          resolve: () => '2026-10-28T12:00:00.000Z',
        },
        email: {
          type: scalars.EmailAddressResolver,
          resolve: () => 'editor@example.com',
        },
        status: {
          type: gql.GraphQLString,
          resolve: () => 'ok',
        },
      },
    }),
  });

  const schemaErrors = gql.validateSchema(schema).map((error) => error.message);
  assert.deepEqual(schemaErrors, [], `${label}: invalid scalar/schema types`);
  const result = await gql.graphql({
    schema,
    source: '{ status date email dateType: __type(name:"DateTime") { name kind } emailType: __type(name:"EmailAddress") { name kind } }',
  });
  assert.deepEqual((result.errors ?? []).map((error) => error.message), [], `${label}: runtime errors`);
  assert.equal(result.data?.status, 'ok', label);
  assert.equal(result.data?.email, 'editor@example.com', label);
  assert.equal(result.data?.dateType?.kind, 'SCALAR', label);
  assert.equal(result.data?.emailType?.kind, 'SCALAR', label);
  process.stdout.write(`PASS: ${label} graphql-scalars type and runtime compatibility\\n`);
}

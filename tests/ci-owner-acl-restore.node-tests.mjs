import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertMockEnvironment, assertRoleEvidence } from '../scripts/ci/verify-owner-acl-restore.mjs'
const environment={GITHUB_ACTIONS:'true',CI:'true',RUN_DATABASE_TESTS:'1',DATABASE_URI:'postgres://mock:mock@localhost:5432/mock'}
const positive={owner:'hls_ci_restore_owner',rlsEnabled:true,forceRls:false,totalRows:2,
 reader:'hls_ci_restore_reader',superuser:false,bypassRls:false,rlsActive:true,
 canSelect:true,canInsert:false,visibleRows:1,schemaUsage:true,policyCount:1,tableGrant:true}
test('mock-only gate refuses other databases/environments',()=>{
 assert.doesNotThrow(()=>assertMockEnvironment(environment))
 for(const v of [{GITHUB_ACTIONS:'false'},{CI:'false'},{RUN_DATABASE_TESTS:'0'},
   {DATABASE_URI:'postgres://mock:mock@localhost:5432/other'},
   {DATABASE_URI:'postgres://x@remote.example/production'}])
   assert.throws(()=>assertMockEnvironment({...environment,...v}),/OWNER_ACL_RESTORE_NOT_MOCK_CI/)
})
test('accepts correct synthetic privilege and role evidence',()=>{
 assert.doesNotThrow(()=>assertRoleEvidence(positive))
})
test('fails closed for owner, grant, policy or row isolation drift',()=>{
 for(const v of [{owner:'mock'},{rlsEnabled:false},{forceRls:true},{totalRows:1},
   {reader:'mock'},{superuser:true},{bypassRls:true},{rlsActive:false},
   {canSelect:false},{canInsert:true},{visibleRows:2},{schemaUsage:false},
   {policyCount:0},{tableGrant:false}])
   assert.throws(()=>assertRoleEvidence({...positive,...v}),/OWNER_ACL_RESTORE_EVIDENCE_FAILED/)
})

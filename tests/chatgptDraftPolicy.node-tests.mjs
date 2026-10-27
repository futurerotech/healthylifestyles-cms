import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraftInput } from '../src/lib/chatgptDraftPolicy.ts';
function example() {
  return {
    title: 'Period Calculator: When Is Your Next Period?',
    slug: 'period-calculator-next-period-dates-guide',
    excerpt: 'A practical guide to tracking and forecasting menstrual cycles and interpreting limits.',
    category:14,author:1,tags:[15,18],primaryTool:36,
    relatedTools:[35,33],relatedArticles:[6,23],
    hasFAQ:true,isHowTo:false,isHealthTopic:false,
    layout:[
      {blockType:'text',style:'p',text:'Use [Period Calculator](/tools/period-calculator), [Ovulation Calculator](/tools/ovulation-calculator), and [Due Date Calculator](/tools/due-date-calculator). Also see [Due Date Guide](/wellness-hub/due-date-by-conception-date) and [Diary Guide](/wellness-hub/how-to-keep-a-food-and-symptom-diary). Read [ACOG](https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding) and [NHS](https://www.nhs.uk/symptoms/missed-or-late-periods/) guidance.'},
      {blockType:'toolEmbed',tool:36,label:'Use the period calculator'},
      ...Array.from({length:7},(_,i)=>({blockType:'text',style:'h2',text:`Heading ${i+1}`})),
      ...Array.from({length:6},(_,i)=>({blockType:'text',style:'p',text:`Explanation paragraph ${i+1} about cycle length and prediction accuracy.`})),
      {blockType:'peopleAlsoAsk',heading:'Common questions',items:Array.from({length:5},(_,i)=>({question:'Question '+i+'?',answer:'Detailed clinically careful answer '+i+'.'}))},
      {blockType:'callout',title:'Safety',tone:'warning',text:'Seek care when needed.'},
    ],
    takeaways:[{text:'One.'},{text:'Two.'},{text:'Three.'}],
    sources:[
      {label:'ACOG bleeding',url:'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding'},
      {label:'NHS late',url:'https://www.nhs.uk/symptoms/missed-or-late-periods/'},
      {label:'NHS testing',url:'https://www.nhs.uk/pregnancy/trying-for-a-baby/doing-a-pregnancy-test/'},
    ],
    semanticEntities:Array.from({length:5},(_,i)=>({term:'Relevant term '+i,url:'https://www.nhs.uk/symptoms/missed-or-late-periods/'})),
    seo:{metaTitle:'Period Calculator: When Is Your Next Period?',metaDescription:'Estimate when the next period may start, how cycle predictions work, and why menstrual symptoms need extra context from trusted clinical guidance.',keywords:['menstrual cycle','period calculator','next period'],canonical:'',noIndex:false,ogTitle:'Period Calculator: When Is Your Next Period?',ogDescription:'Read clear and accurate cycle tracking guidance.',twitterTitle:'Period Calculator: When Is Your Next Period?',twitterDescription:'Understand prediction limits and menstrual tracking.'},
    aiImagePrompt:'Premium editorial illustration of menstrual cycle tracking.'
  };
}
test('valid editorial article is forced to never-published status',()=>{
 const checked=validateDraftInput(example());assert.equal(checked.ok,true,JSON.stringify(checked));
 assert.equal(checked.data._status,'draft');assert.equal(checked.data.featured,false);
 assert.equal(checked.data.reviewedByHuman,false);assert.equal(checked.data.reviewer,null);
 assert.equal(checked.data.heroImage,null);assert.equal(checked.data.publishDate,null);
});
test('rejects publish, delete, status, reviewer and featured fields',()=>{
 const data=example();Object.assign(data,{_status:'published',featured:true,reviewedByHuman:true,requestIndexing:true});
 const result=validateDraftInput(data);assert.equal(result.ok,false);
 for(const key of ['_status','featured','reviewedByHuman','requestIndexing'])assert.ok(result.errors.some(x=>x.includes(key)));
});
test('rejects main and SEO title over 60 chars',()=>{
 const d=example();d.title='X'.repeat(61);d.seo.metaTitle='Y'.repeat(61);
 const r=validateDraftInput(d);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.includes('Title')));assert.ok(r.errors.some(x=>x.includes('SEO')));
});
test('rejects missing or wrong interactive calculator',()=>{
 const d=example();d.layout.find(x=>x.blockType==='toolEmbed').tool=999;
 const r=validateDraftInput(d);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.includes('primaryTool')));
});
test('rejects unsafe JS links and non-contextual sources',()=>{
 const d=example();d.layout[0].text='A [malicious](javascript:alert(1)) link.';
 const r=validateDraftInput(d);assert.equal(r.ok,false);
 assert.ok(r.errors.some(x=>x.includes('Unsafe')));
});
test('rejects unknown block types',()=>{
 const d=example();d.layout.push({blockType:'rawHtml',html:'<script>bad</script>'});
 const r=validateDraftInput(d);assert.equal(r.ok,false);assert.ok(r.errors.some(x=>x.includes('Unsupported block')));
});
test('does not mutate the submitted data object',()=>{
 const d=example();const original=JSON.stringify(d);
 validateDraftInput(d);assert.equal(JSON.stringify(d),original);
});

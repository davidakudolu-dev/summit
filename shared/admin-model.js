export const ENTITIES = {
 products:{permission:'products',fields:{title:'text',description:'body',category_id:'uuid?',price_minor:'price',product_type:['digital','physical','course'],image_url:'url?',status:['draft','published','unavailable'],featured:'nonnegative'}},
 categories:{permission:'products',fields:{name:'text'}},
 promotions:{permission:'products',fields:{code:'code',percent:'percent',expires_at:'datetime',max_uses:'positive',active:'boolean',minimum_minor:'nonnegative'}},
 product_assets:{permission:'products',fields:{product_id:'uuid',storage_path:'path',download_limit:'positive?'}},
 summits:{permission:'events',fields:{title:'text',description:'body',starts_on:'date',ends_on:'date',timezone:'text',published:'boolean'}},
 sessions:{permission:'events',fields:{summit_id:'uuid',title:'text',description:'body',starts_at:'datetime',ends_at:'datetime',category:'text?',location:'text?',meeting_url:'url?',capacity:'positive?',waitlist_enabled:'boolean',registration_closes_at:'datetime',registration_open:'boolean',published:'boolean',price_minor:'nonnegative',cancellation_allowed:'boolean'}},
 speakers:{permission:'events',fields:{name:'text',bio:'body',image_url:'url?'}},
 communities:{permission:'community',fields:{name:'text',description:'body',visibility:['public','members'],join_open:'boolean',published:'boolean'}},
 community_categories:{permission:'community',fields:{community_id:'uuid',name:'text'}},
 articles:{permission:'content',fields:{slug:'slug',title:'text',category:'text',excerpt:'body',body:'body',cover_image:'url?',author:'text',published_at:'datetime?',reading_minutes:'positive',status:['draft','published']}},
 legal_policies:{permission:'settings',fields:{slug:['privacy','terms','cookies','refunds','digital-delivery','community-guidelines','event-terms'],title:'text',body:'body',approved:'boolean'}},
 inquiries:{permission:'inquiries',fields:{status:['new','in_review','contacted','resolved'],internal_notes:'body',assigned_to:'uuid?',follow_up_at:'datetime?'}}
};

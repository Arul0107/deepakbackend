// backend/config/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'admission';

// Create admin client with service role key (for bucket operations)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create public client with anon key (for regular operations)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔌 Supabase Configuration:');
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Bucket: ${bucketName}`);
console.log(`   Service Key: ${supabaseServiceKey ? '✅ Set' : '❌ Not set'}`);
console.log(`   Anon Key: ${supabaseAnonKey ? '✅ Set' : '❌ Not set'}`);

// Function to ensure bucket exists and is properly configured
const ensureBucketExists = async () => {
  try {
    console.log(`\n📦 Checking bucket: ${bucketName}`);
    
    // Try to list buckets using admin client
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.log('⚠️ Cannot list buckets, assuming bucket exists...');
      console.log('Error:', listError.message);
      return true;
    }
    
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`Creating bucket: ${bucketName}...`);
      
      const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/png', 
          'image/gif',
          'image/webp',
          'application/pdf'
        ]
      });
      
      if (error) {
        console.error('Error creating bucket:', error.message);
        return false;
      }
      
      console.log('✅ Bucket created successfully!');
    } else {
      console.log('✅ Bucket already exists');
      
      // Ensure bucket is public
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, {
        public: true
      });
      
      if (updateError) {
        console.log('⚠️ Could not update bucket:', updateError.message);
      } else {
        console.log('✅ Bucket is public');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in ensureBucketExists:', error.message);
    return true; // Return true to continue even if check fails
  }
};

// Initialize bucket on startup
ensureBucketExists().catch(console.error);

module.exports = { 
  supabase, 
  supabaseAdmin, 
  bucketName, 
  ensureBucketExists 
};
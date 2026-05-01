# Google Colab: Prepare SENTINEL-X dataset
# Schedule runs with Google Cloud Scheduler (free tier)

# Mount Google Drive
from google.colab import drive, userdata
drive.mount('/content/drive/')

# Load SENTINEL-X GitHub data
import json, pandas as pd

with open('/content/drive/MyDrive/sentinel_x_github_data.json') as f:
    github_data = json.load(f)

# Convert to DataFrame
issues_df = pd.DataFrame(github_data['issues'])
commits_df = pd.DataFrame(github_data['commits'])

# Feature engineering
issues_df['body_length'] = issues_df['body'].apply(lambda x: len(x) if x else 0)
issues_df['title_length'] = issues_df['title'].apply(len)
issues_df['label_count'] = issues_df['labels'].apply(len)
issues_df['is_bug'] = issues_df['labels'].apply(lambda x: 'bug' in x)
issues_df['is_security'] = issues_df['labels'].apply(lambda x: any('security' in l.lower() for l in x))
issues_df['created_hour'] = pd.to_datetime(issues_df['created_at']).dt.hour
issues_df['is_weekend'] = pd.to_datetime(issues_df['created_at']).dt.weekday >= 5

# Save processed dataset
output_path = '/content/drive/MyDrive/sentinel_x_processed_v2.csv'
issues_df.to_csv(output_path, index=False)
print(f"✅ Processed {len(issues_df)} issues (including synthetic anomalies)")
print(f"   Saved to {output_path}")
print(issues_df[['title', 'is_security', 'is_bug']].head())

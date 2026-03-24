module.exports = {
  apps: [
    {
      name: 'sentinel-os',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        NASA_FIRMS_KEY: 'd593eaecf7517e85f90b82eb0c4543c7',
        N2YO_KEY: 'MGSXWT-RQTLR6-PBVVG2-5OKG',
        OWM_KEY: '8f649750e8a098fe8c80587c38e821bb',
        GFW_TOKEN: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtpZEtleSJ9.eyJkYXRhIjp7Im5hbWUiOiJTaXR1YXRpb25hbCBhd2FyZW5lc3MiLCJ1c2VySWQiOjU3NDgxLCJhcHBsaWNhdGlvbk5hbWUiOiJTaXR1YXRpb25hbCBhd2FyZW5lc3MiLCJpZCI6NDg3NSwidHlwZSI6InVzZXItYXBwbGljYXRpb24ifSwiaWF0IjoxNzczMjUxMDQ4LCJleHAiOjIwODg2MTEwNDgsImF1ZCI6ImdmdyIsImlzcyI6ImdmdyJ9.KB_T-apbPqumH-sN-5mG6gLnWzIxHt6zcuSVOsJ_1Nbn2gtJ75XbdEn19NqpEs_R15qQYHar6s7C8A8MRGyquQnILLr8a_jncq7dlzCXuQc_3NtEQSp9vUJ3A7oOi3Uo6wjGgx7k58wKXp_6m-OpmNkj2fd8G8rK65zeF_Lwd8xOj_6XJJUZZ7d-2BIsAsD8EwiH4SpeoO2IbAbNrawMjDenkw-TfPOhID5oqRhXye0fTxWRyXpoDL271x6y6ULWo7y6PuXxhGYQk2cx16-3bOjciyINXhQFyPnOV5aZ6_QOBg6PARFGS9G_IFLq-zFd1AaAVKm9s8EOkyZrUR9yoKFIsP6dRLK4tO1I5ERogppHAQJmz4CLWGXIy704wlCeBnmc1HYyJ-7mf9vb_9stR2CAJarhjAJlHf6IRSZP5Wv4i_n91cIVlH8dxrlUnLMgkkKQSoa788r9rNKu_IzGsprjSwU3D3YGQS6ApS39qhuo432fWMYVqFY_67fySXDM',
        RAPIDAPI_KEY: 'bd6c8c07d6msh5e42c50aa7366ecp159a72jsn80a07bcc907f',
        AVWX_KEY: '5nx1qnm4147AbNZVpyFr1fazOrtKIKh7qo_lPKrgnR0',
        SHODAN_KEY: 'pL2p5Z5uT2MO8tyxHHHaBFHmEj9oWkab',
        NEWS_API_KEY: '8e090cd3723e464baada6c9dabb7afd5',
        AISSTREAM_KEY: '4dbe595485799b0d5bd1eed70330f02762b0f979',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}

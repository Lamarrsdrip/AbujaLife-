using System;
namespace AbujaLife.Economy { public sealed class WalletModel { public long Balance {get;private set;} public event Action<long> Changed; public void ApplyAuthoritativeBalance(long balance){Balance=Math.Max(0,balance);Changed?.Invoke(Balance);} } }

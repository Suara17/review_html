import { Card, Category } from "../types";

export const defaultCategories: Category[] = [
  { id: "cat-1", slug: "computer-network", title: "计算机网络", label: "计算机基础", order: 1 },
  { id: "cat-2", slug: "operating-system", title: "操作系统", label: "计算机基础", order: 2 },
  { id: "cat-3", slug: "mysql", title: "MySQL", label: "数据库", order: 3 },
  { id: "cat-4", slug: "redis", title: "Redis", label: "数据库", order: 4 },
  { id: "cat-5", slug: "design-pattern", title: "设计模式", label: "代码设计", order: 5 },
  { id: "cat-6", slug: "system-design", title: "系统设计", label: "架构设计", order: 6 },
  { id: "cat-7", slug: "python", title: "Python", label: "编程语言", order: 7 },
  { id: "cat-8", slug: "git", title: "Git", label: "协助开发", order: 8 },
  { id: "cat-9", slug: "guan-lan", title: "观澜", label: "特定业务", order: 9 },
  { id: "cat-10", slug: "study-agent", title: "学习研究代理", label: "前沿探索", order: 10 }
];

export const seedCards: Card[] = [
  // 计算机网络
  {
    id: "net-1",
    slug: "computer-network",
    category: "计算机基础",
    title: "什么是 TCP 三次握手过程？为什么不能用两次握手？",
    content: `<p><strong>TCP 三次握手 (Three-way Handshake)</strong> 是在客户端和服务器之间建立可靠的 TCP 连接的过程。具体流程如下：</p>
    <ul>
      <li><strong>SYN阶段 1 (Client → Server)：</strong> 客户端发送一个 SYN 报文（SYN=1, seq=x），并进入 <code>SYN_SENT</code> 状态。这代表客户端发起连接请求。</li>
      <li><strong>SYN-ACK阶段 2 (Server → Client)：</strong> 服务器接收到 SYN 报文后，回复一个 SYN-ACK 报文（SYN=1, ACK=1, seq=y, ack=x+1），并进入 <code>SYN_RCVD</code> 状态。这代表服务器确认了客户端的发包能力，并也发起了一次同向确认。</li>
      <li><strong>ACK阶段 3 (Client → Server)：</strong> 客户端接收到确认后，发送最后的 ACK 报文（ACK=1, ack=y+1），连接建立。双方进入 <code>ESTABLISHED</code> 状态。</li>
    </ul>
    <p><strong>为什么不能是二次握手？</strong></p>
    <p>1. <strong>防止已失效的连接请求报文段突然又传送到了服务端，产生脏连接。</strong> 假设客户端发出第 1 个连接信号，网络发生堵塞延迟，客户端以为丢失重发第 2 个顺利建立连接。过后，第 1 个延迟的信号到达服务器，若是二次握手，服务器会立刻认为是新握手而打开资源通道进行服务。而此时客户端对此信号已忽略，无需传输，这将空耗服务器宝贵网络资源。</p>
    <p>2. <strong>为了验证彼此的发送和接收能力双向正常。</strong> 二次握手只能确保服务器收到了客户端的信息，却无法让服务器确定客户端有没有收到服务器发送的确认包。</p>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },
  {
    id: "net-2",
    slug: "computer-network",
    category: "计算机基础",
    title: "HTTP 1.1 与 HTTP 2.0 及 3.0 的核心差别是什么？",
    content: `<p>随着万维网的发展，HTTP 协议经过了数次迭代以解决网络连接效率和延迟问题：</p>
    <ul>
      <li><strong>HTTP/1.1：</strong> 引入了 <strong>持久连接 (Keep-Alive)</strong> 允许复用 TCP 连接。缺点是存在 <strong>头部阻塞 (Head-of-line Blocking)</strong>，同一时刻一个 TCP 通道只能处理一个完整的请求，后面请求被阻断直至前面完成。</li>
      <li><strong>HTTP/2.0：</strong> 基于二进制帧结构，引入了 <strong>多路复用 (Multiplexing)</strong> 机制。允许在同一个 TCP 连接上并发出数百个请求，各个请求的数据帧交错收发，克服了 HTTP 层的头部阻塞。同时引入 <strong>头部压缩 (HPACK)</strong> 和 <strong>服务器推送 (Server Push)</strong>。</li>
      <li><strong>HTTP/3.0：</strong> 彻底抛弃了慢速且极易丢包阻塞的 TCP，引入了谷歌研发的基于 UDP 协议的 <strong>QUIC 协议</strong>。这彻底解决了底层 <strong>TCP 的头部阻塞问题</strong>。当某一帧发生丢失，只影响关联的单个流，其他数据流传输不予中断。支持极速的 <strong>0-RTT 连接重建</strong>，即便设备在 4G/Wi-Fi 間切换，也能实现连接无感无缝漫游。</li>
    </ul>`,
    order: 2,
    updatedAt: new Date().toISOString()
  },

  // 操作系统
  {
    id: "os-1",
    slug: "operating-system",
    category: "计算机基础",
    title: "进程、线程、协程有什么区别，它们是如何调度的？",
    content: `<p>在赛博核心的进程控制中，有三大不同的执行实体：</p>
    <ul>
      <li><strong>进程 (Process)：</strong> 操作系统资源分配和调度的 <strong>基本单位</strong>。进程拥有属于自己独立的虚拟内存内存空间、文件描述符等。进程间通信 (IPC) 代价高昂。</li>
      <li><strong>线程 (Thread)：</strong> CPU 独立运行调度执行的 <strong>最小单位</strong>。线程是隶属于进程内部的，它们共享所属进程的内存和资源，切换成本显著低于进程，但多线程并发时须警惕死锁或临界资源脏写。</li>
      <li><strong>协程 (Coroutine)：</strong> 属于 <strong>用户态/轻量级线程</strong>。不由操作系统内核强制调度，而是完全由开发者在应用代码中手动协作切出与回复（通过 yield 或 async/await ）。由于协程免除了内核上下文切换开销，可以在单线程内轻松支持千万级的并发任务。</li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // MySQL
  {
    id: "db-1",
    slug: "mysql",
    category: "数据库",
    title: "InnoDB 默认的幻读解决方案是什么？它是如何工作的？",
    content: `<p><strong>幻读 (Phantom Read)</strong> 是指在同一个事务中执行两次相同的查询（返回某一符合条件的范围结果集），在两次查询之间另一并发事务执行了新增操作，导致后一次读取返回了先一次没读取到的行。</p>
    <p>MySQL 的 InnoDB 存储引擎在 <strong>可重复读 (Repeatable Read)</strong> 隔离级别下，采取了如下强力方案防范幻读：</p>
    <ul>
      <li><strong>在快照读 (Snapshot Read) 下：</strong> 通过 <strong>MVCC (多版本并发控制)</strong> 机制，在读取时基于快照读视图，仅能读取到版本链建立以前和当前事务认可的行版本，巧妙而低耗地规避了幻读。</li>
      <li><strong>在当前读 (Current Read - 如 select for update) 下：</strong> 无法单靠快照多版本解决。此时 InnoDB 会启用 <strong>Next-Key Locks (临键锁)</strong> 机制。Next-Key Locks 实际上是由 <strong>Record Lock (记录锁)</strong> 与 <strong>Gap Lock (间隙锁)</strong> 拼合而成，不仅锁牢当前行，还会彻底封锁查询涉及到的空白行间隙，阻断其他并发写入在相应区间内注入数据。</li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // Redis
  {
    id: "redis-1",
    slug: "redis",
    category: "数据库",
    title: "缓存穿透、缓存击穿、缓存雪崩的成因与究极防御？",
    content: `<p>大规模高并发应用场景中，Redis 缓存层可能遭遇的三大高危缺陷：</p>
    <ol>
      <li><strong>缓存穿透：</strong> 指查询一个 <strong>根本不存在</strong> 的数据，缓存没有，于是穿透直落去数据库查询，导致主库瞬时遭受疯狂重创。
        <br/><em>防御：</em> 部署 <strong>布隆过滤器 (Bloom Filter)</strong> 预判断拦截；或将未知 Key 的查询结果在 Redis 中缓存为空对象 <code>(null)</code> 并设置较短的过期时间。
      </li>
      <li><strong>缓存击穿：</strong> 指一个 <strong>高热度 Key (热点数据)</strong>，在某一瞬间突然过期失效。此时海量的高并发请求瞬间绕过缓存灌入数据库核心，使其瘫痪。
        <br/><em>防御：</em> 使用分布式锁 <code>SETNX</code> 确保单一线程去回源构建缓存；或通过代码设置部分超热 Key 为 <strong>“逻辑永不过期”</strong>。
      </li>
      <li><strong>缓存雪崩：</strong> 指 <strong>大批量 Key 在相同时间大面积集中过期</strong>，或 Redis 集群由于物理或逻辑故障彻底瘫痪，原由其防护的数据流量一瞬间集体冲塌后端数据库。
        <br/><em>防御：</em> 在 Key 过期时间上加上一个随机范围抖动因子；构建高可用 <strong>Redis Sentinel/Cluster</strong> 控制系统；对下游流量进行主动限流、降级保护。
      </li>
    </ol>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // 设计模式
  {
    id: "dp-1",
    slug: "design-pattern",
    category: "代码设计",
    title: "如何写一个绝对线程安全且高性能的双重检查单例？",
    content: `<p><strong>单例模式 (Singleton Pattern)</strong> 保证一个类在全系统中仅存在一个受控实例。在多线程环境中保证安全和延迟高效率需要以下最佳实践：</p>
    <p>以下是 Java 实存的双重校验锁 (Double-Checked Locking) 典范模式：</p>
    <pre><code>public class CyberMatrix {
    // 必须有 volatile 关键字，防止指令重排
    private static volatile CyberMatrix instance;

    private CyberMatrix() {} // 私有构造，封死外部构造

    public static CyberMatrix getInstance() {
        if (instance == null) { // 第一步筛：非空验证性能优化
            synchronized (CyberMatrix.class) { // 并发上锁
                if (instance == null) { // 第二步筛：防止重复建实例
                    instance = new CyberMatrix();
                }
            }
        }
        return instance;
    }
}</code></pre>
    <p><strong>关键点拆解：</strong></p>
    <ul>
      <li><strong>同步锁 (synchronized)：</strong> 确保同一瞬间若有线程并列，只有一个能申请到锁。</li>
      <li><strong>双重判断：</strong> 如果不加第一重判断，每次拿实例都要经过高耗能锁排队；如果不加第二重，当有两个线程都在第一重过筛时，前一个建完了释放锁，排队中的后一个又会再建一个新的，打破唯一性。</li>
      <li><strong>使用 <code>volatile</code> 核心：</strong> 在并发下 <code>new CyberMatrix()</code> 实际上包含：
        <ol>
          <li>分配内存空间</li>
          <li>初始化构造对象</li>
          <li>将堆引用连到变量上</li>
        </ol>
        CPU 编译时存在无序指令重排，没有 volatile 会导致步骤 3 提前于 2 执行。别的并发线程就会在最外层读取到一个非 null 却未初始化的“空壳”残缺对象发生崩溃。
      </li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // 系统设计
  {
    id: "sd-1",
    slug: "system-design",
    category: "架构设计",
    title: "秒杀系统的高并发高可用极限架构怎么设计？",
    content: `<p>一个在赛博世界每秒接受数百万下单冲击的秒杀商城核心架构：</p>
    <ul>
      <li><strong>1. 流量削峰 (Shaving Flow)：</strong> 把整个静态页面、商品详情放到 <strong>CDN 网关边缘</strong> 进行拦截，杜绝主服收到静态资源冲击。</li>
      <li><strong>2. 漏斗限流 (Rate Limiting + Token Bucket)：</strong> 在反向代理层（Nginx / OpenResty）采用 Lua 脚本拦截疯狂刷单的机器人，配合 <strong>令牌桶算法</strong> 直接丢弃恶意多发异常流量。</li>
      <li><strong>3. 缓库存扣减 (Redis Check)：</strong> 秒杀千万别直接动数据库。提前把商品售完上限载入 Redis。当请求进来时，由于 Redis 支持超快的原子指令 <code>DECRBY</code>，库存扣减只需数十微秒。扣减成功后才放行请求去生成订单。</li>
      <li><strong>4. 异步排队 (Message Queue)：</strong> 扣除缓存库存后，投递事务消息至 <strong>RocketMQ / Kafka</strong> 消息队列，由后台订单服务消费者以恒定的低频消费能力从容拉取处理。</li>
      <li><strong>5. 服务熔断/降级：</strong> 采用 <strong>Sentinel / Hystrix</strong>。一旦发现后端生成单库响应极慢或连接见底，立刻向外部发送「商品被抢空啦/服务器繁忙」的提示。确保即使系统到负荷，也不影响其他正常浏览模块运行。</li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // Python
  {
    id: "py-1",
    slug: "python",
    category: "编程语言",
    title: "Python 的垃圾回收 (Garbage Collection) 是怎么运转的？",
    content: `<p>Python 解释器（主要是 CPython）采用了<strong>结合三代复合防御</strong>的垃圾回收策略：</p>
    <ul>
      <li><strong>1. 引用计数 (Reference Counting) - 一线防线：</strong> 
      每个新建的对象都携带一个引用计数器 <code>ob_refcnt</code>。只要该对象被引用，计数便累加 1；当引用退出、被赋值新值或 <code>del</code> 时计数便扣减 1。一旦其计数被扣归零，对象内存就会瞬时被操作系统和解释器直接回笼释放。
      </li>
      <li><strong>2. 标记-清除 (Mark & Sweep) - 破解死局：</strong>
      由于单纯的引用计数对于 <strong>“循环锁死引用”</strong>（对象 A 引用 B，且 B 发出引用反指 A，即便 A、B 在局部作用域均已死亡离开，其计数也总是为 1）无能为力。为了打破这种垃圾回收绝望胡同，Python 定期会停摆执行此算法。它会遍历对象群星链表，标志出所有可抵达的活动对象链。凡是没有标记落入、孤立循环锁死的节点均一律清除。
      </li>
      <li><strong>3. 分代回收 (Generational Collection) - 性能妥协：</strong>
      Python 将所有生存期对象细分为 3 代（0代：新创建，1代：经历一次存活，2代：万年常驻不倒老对象）。0 代垃圾清理最高频、最频繁，经历层层大洗礼洗牌而幸免遇难的对象会跃迁升级入更高的老生代中，2代老对象由于被定义为极为稳妥的类、函数，垃圾清洗频率被压到极低，从而避免反复扫描全内存，取得宏观系统负载平衡。
      </li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // Git
  {
    id: "git-1",
    slug: "git",
    category: "协助开发",
    title: "git merge 还是 git rebase 应该如何抉择？",
    content: `<p>在版本矩阵的回溯中，通常有两派不同的分支演进法则：</p>
    <ul>
      <li><strong>Git Merge (合并)：</strong>
        当在主干（main）执行 merge feature 分支时，Git 会创造一个全新的 <strong>“Merge Commit”节点</strong> 来粘合两条树枝。
        <br/><em>特质：</em> 它是 <strong>非破坏性</strong> 的，保存了每个提交发生的准确客观历史顺序和分支来龙去脉。缺点是会有很多无意义的「Merge branch 'x'」节点，且并发合并频繁时，提交拓扑图会编织成庞大而极度扭曲的「发丝网」图，不忍直视。
      </li>
      <li><strong>Git Rebase (变基)：</strong>
        从 feature 起源分叉点开始，把自己的这一派积累的 commit，以临时存储文件的形式打包。然后直接将自己的基础分叉点 <strong>嫁接、挪移到最新的 main 顶点</strong>，最后在顶点层级按次序重新播映自己的 commit 节点。
        <br/><em>特质：</em> 提交记录在拓扑上将会连成完完全全的 <strong>“完美一条垂直线”</strong>，异常整洁清澈。然而它具有<strong>历史写改破坏性</strong>。如果分支已经被推送到外部服务器共享，切忌在上面执行 rebase！这会引发别人协作拉取时的本地多重提交黑洞。
      </li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // 观澜
  {
    id: "gl-1",
    slug: "guan-lan",
    category: "特定业务",
    title: "什么是「观澜」深度架构设计？如何在高抗压系统中实现实时观测？",
    content: `<p>「观澜」代表着在大规模分布式流控和实时监控系统中实现 <strong>“静观波澜、了如指掌”</strong> 的深度全局透视能力：</p>
    <ul>
      <li><strong>1. 实时全链路流图：</strong>
      基于分布式链路追踪 <code>(OpenTelemetry/Jaeger)</code>，自动为通过复杂网关、微服务链条层层流转的每个请求绑定全局唯一的 <code>TraceID</code>。
      </li>
      <li><strong>2. 低侵入动态探针：</strong>
      使用 <strong>eBPF (Extended Berkeley Packet Filter)</strong> 在 Linux 内核层面注入无侵入探针，能够在完全不重构、不打扰应用代码的情形下，静默采集应用在宿主机层面的 TCP 重传率、连接延迟及堆栈运行异常。
      </li>
      <li><strong>3. 实时波动指标平滑化：</strong>
      使用滑动窗口与指数加权移动平均（EWMA）算法对大规模集群吞吐、QPS 进行秒级实时降噪，防止极短偶发网络抖动激发起高警报，提供更具参考价值的「深海式」平滑趋势预测视角。
      </li>
    </ul>`,
    order: 1,
    updatedAt: new Date().toISOString()
  },

  // 学习研究代理
  {
    id: "agent-1",
    slug: "study-agent",
    category: "前沿探索",
    title: "学习研究代理 (Learning/Research Agent) 在大模型应用下的经典决策回路？",
    content: `<p>当代的 <strong>自主学习研究代理（Research Agent）</strong> 在针对外部环境和海量知识进行定向调研反馈时，其核心工作循环基于著名的 <strong>CoT + ReAct (Reason-Act)</strong> 决策链路运作：</p>
    <ol>
      <li><strong>感知 (Sense / Retrieve)：</strong>
      研究代理通过检索相关的向量库（RAG）、维基网络 API，收集目标课题所需的万千文字输入。
      </li>
      <li><strong>规划与思考 (Reason / Reflect)：</strong>
      利用大模型的能力，将复杂的大目标拆分为数十个子研究步骤。在内部维护一个 **短程规划树 (Plan-Step List)** 和 **反射机制 (Self-Reflection)** — 随时复盘前一步搜寻到的线索是否有意义。如果得到的是无价值垃圾页面，立刻更换搜寻关键词。
      </li>
      <li><strong>工具执行 (Act / Execute)：</strong>
      通过自主生成的工具调用（Tool Calls），例如调用搜索引擎、读取本地文件、整理为 CSV 等。
      </li>
      <li><strong>总结生成 (Synthesize)：</strong>
      将所得知识进行高度精细的关联和合并分析，最终输出格式规范的深度调研报告。
      </li>
    </ol>`,
    order: 1,
    updatedAt: new Date().toISOString()
  }
];

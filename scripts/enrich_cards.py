"""Enrich all 198 interview cards with detailed, conversational answers.
Priority: hand-written for key cards → smart generic expansion for rest.
"""
import json, re, random
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / 'topics-data'
random.seed(42)

# ═══════════════════════════════════════════════════
# 1. Hand-written detailed answers (most important cards)
# ═══════════════════════════════════════════════════

HAND_WRITTEN = {
    'computer-network': {
        '1. 从输入 URL 到页面展示': (
            '<p>这道题是面试网络部分的经典开场题。整个过程可以概括为四步：'
            '先 DNS 解析拿到 IP，再建立 TCP 连接（如果是 HTTPS 还要 TLS 握手），'
            '然后发送 HTTP 请求并接收响应，最后浏览器解析渲染页面。'
            '详细展开的话，第一步是域名解析——浏览器会先查自己的缓存、系统缓存、路由缓存，'
            '都没命中才去 DNS 服务器递归查询。第二步是三次握手建立 TCP 连接，这个过程体现了可靠传输的设计思想。'
            '第三步是 HTTP 请求和响应，涉及请求头、响应状态码、缓存策略等。'
            '第四步是浏览器渲染，包括 HTML 解析成 DOM、CSS 解析成 CSSOM、合成渲染树、布局和绘制。'
            '每个环节都可能成为性能瓶颈，面试官追问哪个环节都可以继续深挖。</p>'
        ),
        '2. DNS 是什么': (
            '<p>DNS 的全称是域名系统，做的事情就是把域名翻译成 IP 地址。你可以把它想象成互联网的电话簿——'
            '你输入 baidu.com，它告诉你 IP 是 220.181.38.148。有两个细节值得注意：'
            '一是 DNS 有缓存机制——浏览器、操作系统、路由器、本地 DNS 服务器都有缓存，这也是改完 DNS 解析要等一段时间才生效的原因。'
            '二是 DNS 不只做正向解析（域名到 IP），还能反向解析（IP 到域名），邮件服务器常用它做反垃圾校验。'
            '面试官常追问的是完整解析过程和递归/迭代的区别，建议这两个提前准备好。</p>'
        ),
        '3. DNS 解析过程': (
            '<p>DNS 的解析过程是层层递归再回溯。当你在浏览器输入域名，'
            '先查浏览器缓存和操作系统 hosts 文件——这是最快的。没命中就去问本地 DNS 服务器（一般是网络运营商提供的）。'
            '本地 DNS 也不知道的话，它会代替你去问根域名服务器。根服务器不会直接给你答案，'
            '它会告诉你该去问哪个顶级域服务器（比如 .com 的服务器）。顶级域服务器指引你去问权威域名服务器。'
            '权威域名服务器最后才返回真正的 IP。整个过程叫递归查询，但服务器之间其实是迭代查询。'
            '面试能把这个分层结构说清楚，会给面试官留下好印象。</p>'
        ),
        '4. 递归查询和迭代查询': (
            '<p>一句话总结：递归是你只管问一次，对方负责查到底；迭代是对方告诉你下一步该去问谁，你自己接着问。'
            '调试中如果遇到 DNS 慢的问题，就能通过这个区别定位——'
            '如果是递归超时，通常是本地 DNS 上游响应慢；如果是迭代慢，可能是某一级服务器出问题了。'
            '面试时能结合这个排查思路来说，比单纯背定义要好很多。</p>'
        ),
        '5. HTTP 是什么': (
            '<p>HTTP 是超文本传输协议，是浏览器和服务器之间沟通的语言。核心特点有三个：'
            '一是简单可扩展——请求行、头部、体结构清晰，头部字段可以不断扩展。'
            '二是无状态——服务器不记忆之前的请求，这也是 Cookie 和 Session 存在的原因。'
            '三是支持客户端-服务器模式，天然适合 Web 场景。'
            '面试官常顺着问版本演进、缓存策略、状态码，建议把这些串起来一起准备。</p>'
        ),
        '8. HTTP/3 / QUIC': (
            '<p>HTTP/3 是为了解决 TCP 协议的一些固有问题而生的。最大的痛点是 TCP 的队头阻塞——'
            '即使 HTTP/2 在应用层解决了请求排队，但 TCP 保证有序传输的特性导致：一个包丢了，后面所有流都得等它重传。'
            'QUIC 基于 UDP，把控制权从内核移到应用层，丢包只影响单个流，不阻塞其他流。'
            '另外连接建立可以 0-RTT，网络切换（比如 WiFi 切 4G）也不需要重连。'
            '所以 HTTP/3 更适合移动端和高延迟、高丢包的场景。</p>'
        ),
        '10. 什么是幂等': (
            '<p>幂等就是同一个操作执行多次和一次效果一样。GET 是幂等的——查几次结果都一样。'
            'PUT 和 DELETE 在 REST 设计里通常也是幂等的——同样的更新或删除执行多次结果一致。'
            'POST 一般不是幂等的——提交两次订单可能会创建两条记录。'
            '这个区分在实际接口设计里很重要，面试官问 RESTful 风格时经常会考到。</p>'
        ),
    },
    'operating-system': {
        '1. 什么是操作系统': (
            '<p>操作系统是管理计算机硬件和软件资源的系统软件，是应用程序和硬件之间的桥梁。'
            '你可以这样想象：没有操作系统的话，程序员得自己管内存、自己调度 CPU、自己操作磁盘——那太复杂了。'
            '操作系统把这些封装成系统调用，让应用只关心业务逻辑。'
            '它的核心职责是四个管理：进程管理（哪个程序什么时候运行）、'
            '内存管理（程序怎么用内存、怎么隔离）、文件系统（数据怎么组织到磁盘）、设备管理（外设怎么统一访问）。'
            '面试常考的进程线程、虚拟内存、IO 模型，都是围绕这四个管理展开的。</p>'
        ),
        '3. 进程和线程有什么区别': (
            '<p>进程是资源分配的基本单位，线程是 CPU 调度的基本单位——这是最核心的区别。'
            '进程有独立的地址空间、文件描述符表、信号处理等，所以进程间通信需要 IPC（管道、共享内存、消息队列等），开销比较大。'
            '线程是进程内部的执行单元，共享进程的内存和资源，通信直接读共享变量就行了，但要注意并发安全问题。'
            '所以说进程更适合做隔离性要求高的场景，线程更适合做高并发、需要共享数据的场景。'
            '面试官接着问协程的区别时，可以从「谁调度、切换成本、支持的并发量」三个维度来对比。</p>'
        ),
        '6. 进程间通信（IPC）方式有哪些': (
            '<p>进程间通信主要有管道、消息队列、共享内存、信号量、Socket 这几种方式。'
            '管道是半双工的，适合父子进程之间简单通信。消息队列是按消息体来通信的，可以多对多。'
            '共享内存是最快的 IPC 方式，但需要信号量配合来同步互斥。'
            'Socket 则支持不同机器之间的进程通信，是最通用的方式。'
            '面试常问的是各种方式的优缺点和适用场景，以及你在项目中实际用过哪种。</p>'
        ),
    },
    'mysql-topics': {
        '1. MySQL 索引是什么': (
            '<p>索引是一种帮 MySQL 快速定位数据的数据结构，本质上是拿空间换时间。'
            '没有索引时 MySQL 只能全表扫描，数据量大就非常慢。'
            'InnoDB 默认用 B+ 树——树高低（三层能存千万级），每次查询只要几次磁盘 IO；'
            '叶子节点有序且存完整数据，范围查询效率很高。'
            '面试常考聚簇索引和非聚簇索引的区别、最左匹配原则、索引下推。'
            '实际工作中建索引要结合具体 SQL 来分析，不是越多越好，因为每个索引都会拖慢写入速度。</p>'
        ),
        '4. 什么是聚簇索引和非聚簇索引': (
            '<p>聚簇索引的叶子节点直接存整行数据，InnoDB 的主键索引就是聚簇索引——所以主键查询非常快。'
            '非聚簇索引的叶子节点存的是主键值，不是完整数据——所以通过非聚簇索引查询时，'
            '先找到主键值，再回表查聚簇索引拿到完整数据，这个过程叫回表查询。'
            '面试中常问的一个优化点是：如果查询的字段都包含在非聚簇索引里，就不需要回表，这叫覆盖索引，性能高很多。</p>'
        ),
        '8. 什么是事务？ACID 是什么': (
            '<p>事务是一组要么全部成功要么全部回滚的操作。ACID 是事务的四个特性：'
            '原子性——事务里的操作要么都做完要么都不做；一致性——事务前后数据满足所有约束；'
            '隔离性——并发事务之间互相不干扰；持久性——事务提交后数据不会丢失。'
            '面试官常追问的是 InnoDB 怎么实现这些特性的——原子性靠 undo log，持久性靠 redo log，'
            '隔离性靠 MVCC 和锁，一致性靠前面三个共同保证。</p>'
        ),
        '9. 事务的隔离级别有哪些': (
            '<p>SQL 标准定义了四个隔离级别，从低到高分别是：'
            '读未提交——能读到别的事务还没提交的数据，有脏读问题，基本不用；'
            '读已提交——只能读到已提交的数据，解决了脏读，但可能有不可重复读；'
            '可重复读——同一个事务中多次读取结果一致，解决了不可重复读，但可能有幻读；'
            '串行化——事务完全串行执行，最安全但性能最差。'
            'MySQL InnoDB 默认是可重复读，而且通过间隙锁在其中解决了幻读问题。'
            '面试常问的是各个级别解决了什么问题、有什么副作用，以及 InnoDB 默认为什么是可重复读。</p>'
        ),
    },
    'redis-topics': {
        '1. Redis 是什么？有什么特点': (
            '<p>Redis 是一个基于内存的高性能键值数据库，核心特点是快——读写能达到十万级 QPS。'
            '它支持多种数据结构，不只是字符串，还有列表、集合、有序集合、哈希、位图等。'
            '另外 Redis 还提供了持久化（RDB 和 AOF）、主从复制、哨兵和集群等高可用方案。'
            '面试常用场景是缓存、计数器、分布式锁、排行榜、消息队列等。'
            'Redis 的问题主要集中在内存管理、缓存一致性、持久化策略选择上。</p>'
        ),
        '2. Redis 为什么快': (
            '<p>Redis 快的原因可以总结为四点：第一，数据在内存里，避免了磁盘 IO 的开销。'
            '第二，命令执行路径短，而且底层数据结构做了专门优化（比如跳跃表、压缩列表）。'
            '第三，单线程模型避免了锁竞争和上下文切换的开销。'
            '第四，IO 多路复用机制让它能高效处理大量并发连接。'
            '面试官如果追问单线程的局限，可以提一下 Redis 6.0 在网络读写环节引入了多线程来优化。</p>'
        ),
        '3. Redis 是单线程吗': (
            '<p>Redis 的命令执行核心确实是单线程的，但这不意味着整个 Redis 就是单线程的。'
            '比如持久化会 fork 子进程来处理，异步删除也有后台线程。'
            'Redis 6.0 之后在网络读写环节引入了多线程，进一步提升性能。'
            '但核心还是单线程处理命令——这么设计的好处是简化了并发控制，'
            '也不用担心锁竞争问题。面试的重点不是纠结于「绝对的单线程」，而是理解它为什么单线程还能这么快。</p>'
        ),
    },
    'python': {
        '1. Python中的 == 和 is 有什么区别': (
            '<p>这是 Python 面试的经典入门题。== 比较的是值是不是相等，is 比较的是是不是同一个对象（也就是内存地址）。'
            '比如 a = [1, 2]; b = [1, 2]——a == b 是 True，但 a is b 是 False，因为它们是两个不同的对象。'
            '但小整数（-5 到 256）和短字符串 Python 会做缓存，所以有时候 is 也会返回 True，面试官常常在这里挖坑。'
            '实际开发中，判断 None 的时候推荐用 is，判断值相等用 == 就够了。</p>'
        ),
        '29. 什么是 GIL': (
            '<p>GIL 是 CPython 的全局解释器锁，它的作用是保证同一时刻只有一个线程在执行 Python 字节码。'
            '这就导致了 Python 多线程在 CPU 密集型任务上没法真正并行——四个线程跑四核 CPU，结果还是轮流跑。'
            '但对于 IO 密集型任务，多线程依然很有价值，因为遇到 IO 等待时会释放 GIL，其他线程可以继续执行。'
            '如果想在 Python 里做 CPU 并行计算，推荐用多进程（multiprocessing）或者用 C 扩展绕过 GIL。'
            '面试官问 GIL 其实是想看你是否理解 Python 的并发模型和它的适用边界。</p>'
        ),
    },
    'git-topics': {
        '1. Git 的三个核心区域': (
            '<p>Git 三个区域是工作区、暂存区、本地仓库。工作区就是你电脑上看到的文件。'
            '暂存区是 git add 后存放待提交内容的地方——相当于一个中间缓冲区。'
            '本地仓库是 git commit 后正式记录历史的地方。'
            '很多 Git 操作都可以用这三个区的移动来理解：add 是把工作区的改动挪到暂存区，'
            'commit 是把暂存区内容写入仓库，checkout 或 reset 是把仓库的内容还原到工作区。'
            '理解了这三个区，Git 百分之八十的操作你都能自己推出来了。</p>'
        ),
        '4. git merge 和 git rebase 有什么区别': (
            '<p>merge 和 rebase 最终目的都是把两个分支的内容整合在一起，但方式不同。'
            'merge 会创建一个新的合并提交，保留两条分支的完整历史——优点是历史真实，缺点是提交图会变复杂。'
            'rebase 是把当前分支的提交「搬」到目标分支的最新提交后面，'
            '相当于重写了提交历史——优点是历史是一条直线很清晰，缺点是改变了提交的 hash，'
            '不适合在公共分支上使用。我的建议是：自己开发的分支用 rebase 保持整洁，公共分支用 merge 保证安全。</p>'
        ),
    },
}

# ═══════════════════════════════════════════════════
# 2. Generic expansion for remaining cards
# ═══════════════════════════════════════════════════

DOMAIN_HOOKS = {
    'computer-network': [
        '计算机网络的知识点很多，但建议串成一条线来记：DNS → HTTP → TCP → IP，每层都有对应的面试题。',
        '实际工作中遇到网络问题，一般先用 ping/telnet 测连通性，再用 curl 看请求细节，最后用 Wireshark 抓包分析。',
        '如果面试官继续追问，可以从报文结构、状态变迁、排查手段几个角度再展开。',
    ],
    'operating-system': [
        '操作系统的概念比较抽象，建议结合 Linux 实际命令来理解——用 top 看进程、free 看内存、strace 看系统调用。',
        '操作系统面试的核心是进程管理、内存管理、IO 和文件系统，每块都有对应的常见问题。',
    ],
    'mysql-topics': [
        'MySQL 慢查询排查是高频场景，通常先开慢查询日志，再用 explain 分析，最后决定加索引还是改写 SQL。',
        '面试时如果能结合自己遇到过的慢查询或死锁案例来说，会比纯背概念有说服力很多。',
    ],
    'redis-topics': [
        'Redis 很多设计思路可以跟 MySQL 对比着理解——一个追求极致性能，一个追求数据完整。',
        '线上用 Redis 最容易出问题的点是 big key、热 key 和慢查询，设计时要提前考虑。',
    ],
    'design-patterns-topics': [
        '设计模式的本质是用接口解耦、用组合代替继承、把变化的逻辑封装起来。',
        '面试时不要只背定义，重点说你用过哪个、在什么场景用的、解决了什么问题。',
    ],
    'system-design-topics': [
        '系统设计题没有标准答案，面试官想看到的是你的思考框架：先定约束、再选方案、最后考虑容错。',
    ],
    'python': [
        'Python 面试中，能说出某个特性的 CPython 实现原理通常会加分很多。',
        '对比其他语言（Java、Go）来理解 Python 的设计取舍，也能体现技术广度。',
    ],
    'git-topics': [
        'Git 的难度不在于命令多，而在于理解「三个区」和「对象不可变性」，大部分操作都能推出来。',
        '日常工作中最常用的是 status、log、branch、commit --amend 和 rebase -i，建议熟练掌握。',
    ],
}

def generic_expand(title: str, content: str, slug: str) -> str:
    """Smart generic expansion preserving original conclusion and points."""
    title_clean = re.sub(r'^\d+[.、]\s*', '', title)
    
    # Extract conclusion and points from the original format
    conclusion = ''
    points = []
    
    mc = re.search(r'<strong>结论：</strong>(.*?)(?:<br|<Br|<)', content)
    if not mc:
        mc = re.search(r'<strong>结论：</strong>(.*)', content)
    if mc:
        conclusion = re.sub(r'<[^>]+>', '', mc.group(1)).strip().rstrip('。。')
    
    for part in content.split('<br>'):
        p2 = re.sub(r'<[^>]+>', '', part).strip()
        m = re.match(r'\d+[.、]\s*(.*)', p2)
        if m:
            points.append(m.group(1).strip().rstrip('。。'))
    
    # Build natural answer
    bits = []
    
    # Opening
    if '是什么' in title or '什么是' in title:
        bits.append(f"关于「{title_clean}」，这是基础面试题，我的理解是这样的。")
    elif '区别' in title or '差异' in title:
        bits.append(f"「{title_clean}」这个问题面试经常被问到，我来梳理一下它们的核心区别。")
    elif '为什么' in title:
        bits.append(f"「{title_clean}」这个问题其实是在考察你对原理是否真正理解，我的分析如下。")
    elif '怎么' in title:
        bits.append(f"「{title_clean}」这个问题，我的回答思路是分步骤来说清楚。")
    else:
        bits.append(f"关于「{title_clean}」，我来展开说一下。")
    
    # Conclusion
    if conclusion:
        bits.append(conclusion + "。")
    
    # Expand points into natural sentences
    if points:
        connectors = ['第一', '第二', '第三', '第四', '第五']
        for i, pt in enumerate(points):
            c = connectors[i] if i < len(connectors) else '另外'
            bits.append(f"{c}，{pt}。")
    
    # Domain hook
    hooks = DOMAIN_HOOKS.get(slug, [])
    if hooks:
        bits.append(random.choice(hooks))
    
    return '<p>' + ' '.join(bits) + '</p>'


def process_file(slug: str):
    path = DATA_DIR / f'{slug}.json'
    if not path.exists():
        return
    data = json.loads(path.read_text('utf-8'))
    kps = data.get('knowledge_points', [])
    hand = HAND_WRITTEN.get(slug, {})
    changed = 0
    
    for kp in kps:
        title = kp['title']
        content = kp['content']
        plain = re.sub(r'<[^>]+>', ' ', content).strip()
        
        # Check for hand-written answer
        matched = None
        for hkey in hand:
            if title.startswith(hkey):
                matched = hand[hkey]
                break
        
        if matched:
            kp['content'] = matched
            changed += 1
        elif len(plain) < 350:
            kp['content'] = generic_expand(title, content, slug)
            changed += 1
    
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{slug}: {len(kps)} cards, {changed} enriched')


def main():
    registry = json.loads((DATA_DIR / 'registry.json').read_text('utf-8'))
    for g in registry['groups']:
        process_file(g['slug'])

if __name__ == '__main__':
    main()

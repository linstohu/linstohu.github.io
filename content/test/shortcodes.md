---
title: "Shortcodes"
date: 2016-08-30T16:01:23+08:00
lastmod: 2018-02-01T18:01:23+08:00
---

# Admonition

{{% admonition note "I'm title!" false %}}
biu biu biu.

{{% admonition type="note" title="note" details="true" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition example %}}
Without title.
{{% /admonition %}}

{{% /admonition %}}

```markdown
{{%/* admonition note "I'm title!" false */%}}
biu biu biu.

{{%/* admonition type="note" title="note" details="true" */%}}
biu biu biu.
{{%/* /admonition */%}}

{{%/* admonition example */%}}
Without title.
{{%/* /admonition */%}}

{{%/* /admonition */%}}
```

<!--more-->

{{% admonition abstract abstract %}}
biu biu biu.
{{% /admonition %}}

```markdown
{{%/* admonition abstract abstract */%}}
biu biu biu.
{{%/* /admonition */%}}
```

{{% admonition info "info" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition tip "tip" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition success "success" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition question "question" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition warning "warning" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition failure "failure" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition danger "danger" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition bug "bug" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition example "example" %}}
biu biu biu.
{{% /admonition %}}

{{% admonition quote "quote" %}}
biu biu biu.
{{% /admonition %}}

# center, right, left

```markdown
## default

![img](/path/to/img.gif "img")

{{%/* center */%}}

## center

![img](/path/to/img.gif "img")
{{%/* /center */%}}

{{%/* right */%}}

## right

![img](/path/to/img.gif "img")
{{%/* /right */%}}

{{%/* left */%}}

## left

![img](/path/to/img.gif "img")
{{%/* /left */%}}
```

## default

![img](/apple-touch-icon.png "img")

{{% center %}}

## center

![img](/apple-touch-icon.png "img")
{{% /center %}}

{{% right %}}

## right

![img](/apple-touch-icon.png "img")
{{% /right %}}

{{% left %}}

## left

![img](/apple-touch-icon.png "img")
{{% /left %}}

---

## figure with class

```
{{%/* figure src="https://example.com/path/to/img.jpg" title="default" alt="img" */%}}
{{%/* figure class="center" src="/path/to/img.gif" title="center" alt="img" */%}}
{{%/* figure class="right" src="/path/to/img.gif" title="right" alt="img" */%}}
{{%/* figure class="left" src="/path/to/img.gif" title="left" alt="img" */%}}
```

{{% figure src="/apple-touch-icon.png" title="default" alt="img" %}}
{{% figure class="center" src="/apple-touch-icon.png" title="center" alt="img" %}}
{{% figure class="right" src="/apple-touch-icon.png" title="right" alt="img" %}}
{{% figure class="left" src="/apple-touch-icon.png" title="left" alt="img" %}}

---

```
{{%/* center */%}}

## hybrid in center
{{%/* figure src="/path/to/img.gif" title="default" alt="img" */%}}
{{%/* figure class="right" src="/path/to/img.gif" title="right" alt="img" */%}}

{{%/* left */%}}
{{%/* figure src="/path/to/img.gif" title="default in left" alt="img" */%}}
{{%/* /left */%}}

{{%/* /center */%}}
```

{{% center %}}

## hybrid in center

{{% figure src="/apple-touch-icon.png" title="default" alt="img" %}}
{{% figure class="right" src="/apple-touch-icon.png" title="right" alt="img" %}}
{{% left %}}
{{% figure src="/apple-touch-icon.png" title="default in left" alt="img" %}}
{{% /left %}}
{{% /center %}}

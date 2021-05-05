---
title: For and ForEach loops in Blazor Components
precis: Using For and ForEach loops in Blazor Components
date: 2020-10-01
---

# For and ForEach Iteration in Blazor Components

Iteration statements such as `for` and `foreach` present challenges in Blazor components that you don't normally face.  In a classic interation implementation, your loop specific code is confined to the loop - you know you can't reference `List[i]` outside the loop.  In Blazor components the actual values/references are crystalised and used long after the loop completes.

Let's look at various examples and see what happens.

## Test.razor

We need a test page with some supporting code:

```csharp
@page "/Test"

// Our iteration code

<div>@_selected</div>

@code {
    private string _selected = "None";

    class Model
    {
        public int Id { get; set; }
        public string Country { get; set; }
    }

    private Task OnClick(int id)
    {
        var x = id;
        _selected = $"{id}";
        return Task.CompletedTask;
    }

    private Task OnClick(Model country)
    {
        _selected = $"{country.Id}";
        return Task.CompletedTask;
    }

    private List<Model> Countries => new List<Model>()
        {
            new Model() { Id = 0, Country = "UK"},
            new Model() { Id = 1, Country = "Spain"},
            new Model() { Id = 2, Country = "Portugal"}
    };
}
```

## The Straight ForEach

This looks like:
 
```csharp
@foreach (var country in Countries)
{
    <div><button class="btn btn-dark m-1" @onclick="() => OnClick(country)">Edit</button>@country.Country</div>
    <div><button class="btn btn-secondary m-1" @onclick="() => OnClick(country.Id)">Edit</button>@country.Country</div>
}
```

Each iteration points `OnClick` to the correct `country` object in `Countries`.

 - When the first button is pressed the reference to the correct country object is passed to `OnClick` - and the correct `Id` is displayed.
 - When the second button is pressed the reference to the correct `int` value is passed to `OnClick` - and the correct `Id` is displayed.

## The Indexed ForEach

This looks like:
 
```csharp
@{ int x = 0;}
@foreach (var country in Countries)
{
    <div><button class="btn btn-danger m-1" @onclick="() => OnClick(x)">Edit</button>@country.Country</div>
    x++;
}
```

Now we're setting a counter which we increment and pass when the button is clicked.  As the loop is complete when we click on the button, `x` is at `Countries.Count` (one iteration after completion of foreach) - in our case 3. `OnClick` is passed 3.

## The For

This looks like this:
 
```csharp
@for (var i = 0; i < Countries.Count; i++)
{
    <div><button class="btn btn-danger m-1" @onclick="() => OnClick(i)">Edit</button> @Countries[i].Country</div>
}
```

Again we're passing the value of the counter when the button is clicked.  As the loop is complete when we click on the button, `x` is at `Countries.Count` (one iteration after completion of foreach) - in our case 3. `OnClick` is passed 3.

## The For with a Local Loop Variable

This looks like this:
 
```csharp
@for (var i = 0; i < Countries.Count; i++)
{
    var item = Countries[i];
    <div><button class="btn btn-success m-1" @onclick="() => OnClick(item.Id)">Edit</button> @item.Country</div>
}
```

We now set a local loop variable and reference that within the loop.    When the button is pressed the reference to the correct value is passed to `OnClick` - and the correct `Id` is displayed.  

## Wrap Up

Hopefully you can see that you should either:
 - Stick to the standard `foreach` loop - it's fairly bulletproof.
 - Use a local loop variable if you have to use `for`.

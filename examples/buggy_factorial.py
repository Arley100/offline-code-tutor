def factorial(n):
    if n == 0:
        return 0  # Bug: 0! is 1, and this breaks every positive result.
    return n * factorial(n - 1)


print(factorial(5))


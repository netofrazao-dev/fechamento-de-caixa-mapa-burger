import { describe, expect, it } from 'vitest'
import { lerLinkDeRecuperacao, traduzirErroLogin } from './auth'

describe('lerLinkDeRecuperacao', () => {
  it('lê o token do link do e-mail', () => {
    expect(lerLinkDeRecuperacao('#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery')).toEqual({
      tipo: 'recuperacao',
      accessToken: 'abc',
      refreshToken: 'def',
    })
  })
  it('link expirado ou inválido vira mensagem clara', () => {
    expect(lerLinkDeRecuperacao('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired').erro).toContain('expirou')
    expect(lerLinkDeRecuperacao('#error=access_denied&error_code=bad').tipo).toBe('erro')
  })
  it('sem token ou de outro tipo: nada', () => {
    expect(lerLinkDeRecuperacao('').tipo).toBe('nenhum')
    expect(lerLinkDeRecuperacao('#access_token=a&refresh_token=b&type=signup').tipo).toBe('nenhum')
  })
})

describe('traduzirErroLogin', () => {
  it('traduz os erros comuns', () => {
    expect(traduzirErroLogin(new Error('Invalid login credentials'))).toBe('E-mail ou senha incorretos.')
    expect(traduzirErroLogin(new Error('For security purposes, you can only request this after 42 seconds.'))).toContain('Espere')
    expect(traduzirErroLogin(new Error('Password should be at least 8 characters'))).toContain('8 caracteres')
  })
})
